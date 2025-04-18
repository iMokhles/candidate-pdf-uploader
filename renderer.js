document.addEventListener("DOMContentLoaded", async () => {
  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");

      // Hide all tab contents and deactivate all tab buttons
      tabContents.forEach((content) => content.classList.remove("active"));
      tabBtns.forEach((btn) => btn.classList.remove("active"));

      // Show the selected tab content and activate the clicked tab button
      document.getElementById(`${tabId}-tab`).classList.add("active");
      btn.classList.add("active");
    });
  });

  // Elements
  const selectPdfBtn = document.getElementById("select-pdf-btn");
  const uploadBtn = document.getElementById("upload-btn");
  const selectCredentialsBtn = document.getElementById(
    "select-credentials-btn"
  );
  const saveConfigBtn = document.getElementById("save-config-btn");
  const addCustomColumnBtn = document.getElementById("add-custom-column");
  const customColumnsContainer = document.getElementById("custom-columns");

  // Current state
  let currentPdfPath = null;
  let customColumnCount = 0;

  // Load configuration
  const config = await window.api.getConfig();
  if (config.credentialsPath) {
    document.getElementById("credentials-path").textContent =
      config.credentialsPath;
  }
  if (config.spreadsheetId) {
    document.getElementById("spreadsheet-id").value = config.spreadsheetId;
  }
  if (config.sheetName) {
    document.getElementById("sheet-name").value = config.sheetName;
  }
  if (config.driveFolderId) {
    document.getElementById("folder-id").value = config.driveFolderId;
  }

  // Select PDF file
  selectPdfBtn.addEventListener("click", async () => {
    currentPdfPath = await window.api.selectPdf();
    if (currentPdfPath) {
      document.querySelector(
        ".current-file p"
      ).textContent = `Selected: ${currentPdfPath}`;
      uploadBtn.disabled = false;
    }
  });

  // Select credentials file
  selectCredentialsBtn.addEventListener("click", async () => {
    const credentialsPath = await window.api.selectCredentials();
    if (credentialsPath) {
      document.getElementById("credentials-path").textContent = credentialsPath;
    }
  });

  // Save configuration
  saveConfigBtn.addEventListener("click", async () => {
    const config = {
      spreadsheetId: document.getElementById("spreadsheet-id").value,
      sheetName: document.getElementById("sheet-name").value || "Sheet1",
      driveFolderId: document.getElementById("folder-id").value || null,
    };

    await window.api.saveConfig(config);
    alert("Configuration saved successfully!");
  });

  // Add custom column
  addCustomColumnBtn.addEventListener("click", () => {
    customColumnCount++;
    const columnId = `custom-column-${customColumnCount}`;

    const columnDiv = document.createElement("div");
    columnDiv.className = "form-group custom-column";
    columnDiv.innerHTML = `
        <div class="custom-column-header">
          <label for="${columnId}-name">Custom Column ${customColumnCount}:</label>
          <button class="remove-column-btn" data-id="${columnId}">Remove</button>
        </div>
        <div class="custom-column-inputs">
          <input type="text" id="${columnId}-name" placeholder="Column Name" class="column-name">
          <input type="text" id="${columnId}-value" placeholder="Column Value" class="column-value">
        </div>
      `;

    customColumnsContainer.appendChild(columnDiv);

    // Add remove button event
    columnDiv
      .querySelector(".remove-column-btn")
      .addEventListener("click", function () {
        const columnId = this.getAttribute("data-id");
        const columnDiv =
          document.getElementById(columnId)?.closest(".custom-column") ||
          this.closest(".custom-column");
        if (columnDiv) {
          columnDiv.remove();
        }
      });
  });

  // Upload and track
  uploadBtn.addEventListener("click", async () => {
    if (!currentPdfPath) {
      alert("Please select a PDF file first.");
      return;
    }

    const name = document.getElementById("name").value;
    if (!name) {
      alert("Please enter a candidate name.");
      return;
    }

    const feedback = document.getElementById("feedback").value;

    // Collect custom column data
    const customColumns = {};
    document.querySelectorAll(".custom-column").forEach((column) => {
      const nameInput = column.querySelector(".column-name");
      const valueInput = column.querySelector(".column-value");

      if (nameInput && valueInput && nameInput.value) {
        customColumns[nameInput.value] = valueInput.value || "";
      }
    });

    // Show loading state
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
    document.getElementById("results-content").innerHTML =
      "<p>Processing...</p>";

    try {
      // Call the API to upload and track
      const result = await window.api.uploadAndTrack({
        name,
        pdfPath: currentPdfPath,
        feedback,
        customColumns,
      });

      // Show results
      if (result.success) {
        document.getElementById("results-content").innerHTML = `
            <div class="success-message">
              <p>Upload successful!</p>
              <p>PDF Link: <a href="${result.link}" target="_blank">${result.link}</a></p>
            </div>
          `;

        // Reset form
        document.getElementById("name").value = "";
        document.getElementById("feedback").value = "";
        document
          .querySelectorAll(".custom-column")
          .forEach((column) => column.remove());
        document.querySelector(".current-file p").textContent =
          "No PDF selected";
        currentPdfPath = null;
      } else {
        document.getElementById("results-content").innerHTML = `
            <div class="error-message">
              <p>Error: ${result.error}</p>
            </div>
          `;
      }
    } catch (error) {
      document.getElementById("results-content").innerHTML = `
          <div class="error-message">
            <p>Error: ${error.message || "Unknown error occurred"}</p>
          </div>
        `;
    } finally {
      // Reset button state
      uploadBtn.disabled = !currentPdfPath;
      uploadBtn.textContent = "Upload and Track";
    }
  });
});
