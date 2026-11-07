// admin/edit_form/edit_form.js
document.addEventListener("DOMContentLoaded", function() {
  const formSelectView = document.getElementById("form-select-view");
  const editFormBuilderView = document.getElementById("edit-form-builder-view");
  const formsListContainer = document.getElementById("forms-list-container");
  const editFormBuilderContainer = document.getElementById("edit-form-builder-container");
  
  let currentFormId = null;
  let optionsData = [];
  let previewTimeout;
  
  function logEditAction(action, formTitle = "") {
    if (!formTitle) {
      const titleEl = document.getElementById('edit-display-form-title');
      if (titleEl) formTitle = titleEl.textContent;
    }
    fetch('log_admin_event.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `Edit Form: ${action}`, form_title: formTitle })
    }).catch(err => console.error("Logging error:", err));
  }
  
  function getQuestionContext(element, overrideOldTitle = null) {
    let contextStr = '';
    const qCard = element.closest('.builder-question-card');
    if (qCard) {
      const qTitleInput = qCard.querySelector('.q-title-input');
      let qTitle = 'Unknown Question';
      if (overrideOldTitle !== null) {
          qTitle = overrideOldTitle;
      } else if (qTitleInput) {
          qTitle = qTitleInput.hasAttribute('data-old-val') ? qTitleInput.getAttribute('data-old-val') : qTitleInput.value.trim();
      }
      
      const section = element.closest('.builder-section');
      let secTitle = 'Archived/Unknown Section';
      if (section) {
        const secTitleElem = section.querySelector('.builder-section-title');
        if (secTitleElem) secTitle = secTitleElem.textContent;
      } else if (element.closest('#archived-sidebar')) {
        secTitle = 'Archived Sidebar';
      }
      
      contextStr = ` (Section: ${secTitle}, Question: ${qTitle || 'Empty Title'})`;
    }
    return contextStr;
  }

  function showInlineError(element, message, position = 'afterend') {
    if (!element) return;
    const existing = element.parentNode.querySelector('.inline-error-text');
    if (existing) existing.remove();
    
    const err = document.createElement('span');
    err.className = 'inline-error-text';
    err.textContent = message;
    
    if (position === 'afterend') {
      element.insertAdjacentElement('afterend', err);
    } else if (position === 'beforebegin') {
      element.insertAdjacentElement('beforebegin', err);
    } else {
      element.appendChild(err);
    }
    
    setTimeout(() => { if(err.parentNode) err.remove(); }, 4000);
  }

  // Options Mapping by ID -> Name
  let optionIdToName = {};

  let globalPreviewBox = document.getElementById('global-options-preview');
  if (!globalPreviewBox) {
    globalPreviewBox = document.createElement('div');
    globalPreviewBox.id = 'global-options-preview';
    globalPreviewBox.className = 'autocomplete-item-preview';
    globalPreviewBox.style.position = 'fixed';
    globalPreviewBox.style.display = 'none';
    globalPreviewBox.style.zIndex = '9999';
    document.body.appendChild(globalPreviewBox);

    globalPreviewBox.addEventListener('mouseenter', () => {
       clearTimeout(previewTimeout);
    });
    globalPreviewBox.addEventListener('mouseleave', () => {
       previewTimeout = setTimeout(() => {
          globalPreviewBox.style.display = 'none';
       }, 250);
    });
  }

  // Fetch Options Data
  function loadOptionsForBuilder() {
    fetch('../options.json?v=' + new Date().getTime())
      .then(response => response.json())
      .then(data => {
        optionsData = data;
        data.forEach(opt => {
          optionIdToName[opt.group_id] = opt.group_name;
        });
      })
      .catch(error => console.error("Error fetching options:", error));
  }
  loadOptionsForBuilder();
  window.addEventListener('optionsUpdated', loadOptionsForBuilder);

  // --- View Management ---
  function showListView() {
    formSelectView.style.display = 'block';
    editFormBuilderView.style.display = 'none';
    closeArchivedSidebar();
    currentFormId = null;
    loadFormsList();
  }

  function showEditView(form) {
    formSelectView.style.display = 'none';
    editFormBuilderView.style.display = 'block';
    
    currentFormId = form.form_id;
    document.getElementById('edit-display-form-title').textContent = form.title;
    
    const descEl = document.getElementById('edit-display-form-desc');
    if (form.description) {
      descEl.textContent = form.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
    
    // Set inputs in modal
    document.getElementById('edit-form-title-input').value = form.title;
    document.getElementById('edit-form-desc-input').value = form.description || '';
    
    // Build the editor based on sections
    editFormBuilderContainer.innerHTML = '';
    
    // Clear archived sidebar
    const archivedList = document.getElementById('archived-sidebar-list');
    if (archivedList) archivedList.innerHTML = '<p id="archived-sidebar-empty" class="archived-sidebar-empty">No archived questions for this form.</p>';
    closeArchivedSidebar();

    if (form.sections && form.sections.length > 0) {
      form.sections.forEach(section => {
        addSection(section);
      });
    }
    updateArchiveBadge();
  }

  document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
      logEditAction('Cancelled Edit (No changes saved)');
      showListView();
  });
  document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      logEditAction('Cancelled Edit (No changes saved)');
      showListView();
  });

  // --- Load Forms List ---
  function loadFormsList() {
    formsListContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading forms...</p>';
    fetch('edit_form/fetch_forms.php')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          formsListContainer.innerHTML = '';
          if (data.forms.length === 0) {
             formsListContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No forms found.</p>';
             return;
          }
          data.forms.forEach(form => {
            const dateStr = new Date(form.created_at).toLocaleDateString();
            let qrHTML = `
                <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              `;
            if (form.qr_image_path) {
              qrHTML = `<img src="../${form.qr_image_path}" alt="QR Code">`;
            }

            const item = document.createElement('div');
            item.className = 'form-card-container';
            item.style.position = 'relative'; // important for the absolute delete button
            item.innerHTML = `
              <!-- Admin Red Cross Delete Button -->
              <button class="admin-delete-btn delete-form-btn" data-id="${form.form_id}" title="Delete Form">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>

              <div class="form-card-front">
                <!-- Official Logo Header -->
                <div class="card-official-header">
                  <div class="card-logos">
                    <img src="../images/vignan's_logo.png" alt="Vignan Logo" class="logo-vignan">
                    <img src="../images/iqac_logo.png" alt="IQAC Logo" class="logo-iqac">
                  </div>
                  <div class="header-divider"></div>
                  <h3 class="card-bright-title">${form.title}</h3>
                </div>

                <!-- QR Code Area -->
                <div class="front-qr-section">
                  <div class="qr-viewfinder">
                    <div class="scanner-line"></div>
                    ${qrHTML}
                  </div>
                </div>

                <!-- Footer Info (Edit Form Module) -->
                <div class="front-footer">
                  <div class="footer-left">
                    <strong class="footer-office">Office of IQAC,<br>VFSTR</strong>
                  </div>
                  <div class="footer-right edit-form-btn" data-id="${form.form_id}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                    <span class="footer-module-title">Edit Form</span>
                    <span style="font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 4px; font-weight: 500; letter-spacing: 0.5px;">
                      Click me <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </span>
                  </div>
                </div>
              </div>
            `;
            formsListContainer.appendChild(item);
          });
          
          // Bind edit buttons
          document.querySelectorAll('.edit-form-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const id = this.getAttribute('data-id');
              loadFormDetails(id);
            });
          });
          
          // Bind delete buttons
          document.querySelectorAll('.delete-form-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const id = this.getAttribute('data-id');
              deleteForm(id);
            });
          });
        }
      })
      .catch(err => {
        console.error(err);
        formsListContainer.innerHTML = '<p style="text-align: center; color: red;">Failed to load forms.</p>';
      });
  }

  function loadFormDetails(id) {
    Swal.showLoading();
    fetch(`edit_form/fetch_form_details.php?id=${id}`)
      .then(res => res.json())
      .then(data => {
        Swal.close();
        if (data.success) {
          showEditView(data.form);
          logEditAction('Opened Form for Editing', data.form.title);
        } else {
          Swal.fire('Error', data.message, 'error');
        }
      })
      .catch(err => {
        Swal.close();
        Swal.fire('Error', 'Failed to load form details.', 'error');
      });
  }

  function deleteForm(id) {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this! All related responses and analytics data will also be permanently lost.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.showLoading();
        fetch('edit_form/delete_form.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ form_id: id })
        })
        .then(res => res.json())
        .then(data => {
          Swal.close();
          if (data.success) {
            Swal.fire('Deleted!', 'The form has been deleted.', 'success');
            loadFormsList(); // Reload the list
          } else {
            Swal.fire('Error!', data.message || 'Could not delete form.', 'error');
          }
        })
        .catch(err => {
          console.error(err);
          Swal.fire('Error!', 'An unexpected error occurred.', 'error');
        });
      }
    });
  }

  // Initial load
  if(document.getElementById('edit-form-section') && document.getElementById('edit-form-section').classList.contains('active')) {
     loadFormsList();
  }
  // Also hook into sidebar navigation to load list when edit tab is clicked
  const editTab = document.querySelector('a[data-target="edit-form-section"]');
  if(editTab) {
     editTab.addEventListener('click', () => {
        if(formSelectView.style.display !== 'none') {
           loadFormsList();
        }
     });
  }

  // --- Edit Metadata Modal ---
  const metaModal = document.getElementById('edit-meta-modal');
  const editQrInput = document.getElementById('edit-form-qr-input');
  const editQrPreviewImg = document.getElementById('edit-qr-preview-img');
  const editQrPreviewContainer = document.getElementById('edit-qr-preview-container');

  if (editQrInput) {
    editQrInput.addEventListener('change', function(e) {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          editQrPreviewImg.src = e.target.result;
          editQrPreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        editQrPreviewContainer.style.display = 'none';
        editQrPreviewImg.src = '';
      }
    });
  }

  const editTitleInput = document.getElementById('edit-form-title-input');
  const saveMetaBtn = document.getElementById('save-meta-modal-btn');
  if (editTitleInput) {
    editTitleInput.addEventListener('blur', function() {
      const title = this.value.trim();
      if (!title) return;
      
      fetch('check_form_title.php?title=' + encodeURIComponent(title) + '&exclude_id=' + currentFormId)
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            showInlineError(editTitleInput, "A form with this name already exists.");
            editTitleInput.style.borderColor = 'var(--error-color)';
            if (saveMetaBtn) saveMetaBtn.disabled = true;
          } else {
            editTitleInput.style.borderColor = '';
            if (saveMetaBtn) saveMetaBtn.disabled = false;
            const err = editTitleInput.parentNode.querySelector('.inline-error-text');
            if (err) err.remove();
          }
        })
        .catch(err => console.error("Error checking title:", err));
    });

    editTitleInput.addEventListener('input', function() {
      this.style.borderColor = '';
      if (saveMetaBtn) saveMetaBtn.disabled = false;
      const err = this.parentNode.querySelector('.inline-error-text');
      if (err) err.remove();
    });
  }

  document.getElementById('edit-meta-btn')?.addEventListener('click', () => {
    metaModal.style.display = 'flex';
  });
  document.getElementById('close-meta-modal-btn')?.addEventListener('click', () => {
    metaModal.style.display = 'none';
  });
  document.getElementById('save-meta-modal-btn')?.addEventListener('click', () => {
    const titleInput = document.getElementById('edit-form-title-input');
    const newTitle = titleInput.value.trim();
    const newDesc = document.getElementById('edit-form-desc-input').value.trim();
    if(!newTitle) {
      showInlineError(titleInput, "Form title cannot be empty");
      return;
    }
    document.getElementById('edit-display-form-title').textContent = newTitle;
    const descEl = document.getElementById('edit-display-form-desc');
    if (newDesc) {
      descEl.textContent = newDesc;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
    metaModal.style.display = 'none';
  });


  // --- BUILDER LOGIC (Adapted from new_form.js) ---
  const addSectionBtn = document.getElementById("edit-add-section-btn");
  
  function updateSectionNumbers() {
    const sections = editFormBuilderContainer.querySelectorAll('.builder-section');
    sections.forEach((section, index) => {
      const num = index + 1;
      section.id = `edit-section-${num}`;
      const title = section.querySelector('.builder-section-title');
      if (title) title.textContent = `Section ${num}`;
    });
  }

  addSectionBtn?.addEventListener('click', () => {
    addSection();
  });

  function addSection(sectionData = null) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'builder-section';
    
    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'builder-section-header';
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.gap = '12px';
    headerDiv.style.flexWrap = 'wrap';
    
    const title = document.createElement('h3');
    title.className = 'builder-section-title';
    title.style.margin = '0';
    
    const sectionNameInput = document.createElement('input');
    sectionNameInput.type = 'text';
    sectionNameInput.className = 'form-control section-name-input';
    sectionNameInput.placeholder = 'Section Name (Optional)';
    sectionNameInput.style.flex = '1';
    sectionNameInput.style.minWidth = '200px';
    if (sectionData && sectionData.section_name) {
      sectionNameInput.value = sectionData.section_name;
    }
    
    const headerActions = document.createElement('div');
    headerActions.style.display = 'flex';
    headerActions.style.gap = '8px';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-danger-outline';
    deleteBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Section`;
    deleteBtn.addEventListener('click', () => {
      sectionDiv.remove();
      updateSectionNumbers();
    });

    headerActions.appendChild(deleteBtn);
    headerDiv.appendChild(title);
    headerDiv.appendChild(sectionNameInput);
    headerDiv.appendChild(headerActions);
    
    // Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '12px';
    actionsRow.style.marginTop = '16px';
    actionsRow.style.flexWrap = 'wrap';
    
    const addQuestionBtn = document.createElement('button');
    addQuestionBtn.className = 'btn-secondary';
    addQuestionBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Add Question`;
    
    const questionsList = document.createElement('div');
    questionsList.className = 'builder-question-list';

    // Make questions sortable within the section
    if (typeof Sortable !== 'undefined') {
      new Sortable(questionsList, {
        animation: 150,
        handle: '.question-card-header',
        ghostClass: 'sortable-ghost',
        scroll: true,
        scrollSensitivity: 100,
        scrollSpeed: 20,
        forceFallback: true,
        bubbleScroll: true
      });
    }
    
    addQuestionBtn.addEventListener('click', () => {
      const existingCards = questionsList.querySelectorAll('.builder-question-card');
      for (let i = 0; i < existingCards.length; i++) {
        const input = existingCards[i].querySelector('.q-title-input');
        if (input && input.value.trim() === '') {
           showInlineError(input, "Please enter the question text for the empty question before adding a new one.");
           input.focus();
           return;
        }
      }
      addQuestion(questionsList);
    });
    
    actionsRow.appendChild(addQuestionBtn);

    const addSubSectionBtn = document.createElement('button');
    addSubSectionBtn.type = 'button';
    addSubSectionBtn.className = 'btn-secondary btn-conditional-block';
    addSubSectionBtn.style.color = '#7c3aed';
    addSubSectionBtn.style.borderColor = '#c4b5fd';
    addSubSectionBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg> Add Conditional Sub-Section`;
    addSubSectionBtn.addEventListener('click', () => {
      addConditionalSubSection(questionsList);
    });
    actionsRow.appendChild(addSubSectionBtn);

    // If it's the first section, add the compulsory buttons
    if (editFormBuilderContainer.children.length === 0) {
      const addRegisterBtn = document.createElement('button');
      addRegisterBtn.className = 'btn-secondary';
      addRegisterBtn.style.color = '#b32b2b';
      addRegisterBtn.style.borderColor = '#b32b2b';
      addRegisterBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Add Register No`;
      addRegisterBtn.addEventListener('click', () => {
        addQuestion(questionsList, {text: 'Register No', type: 'text', required: true}, 'register');
        addRegisterBtn.style.display = 'none'; 
      });
      actionsRow.appendChild(addRegisterBtn);

      const addEmpIdBtn = document.createElement('button');
      addEmpIdBtn.className = 'btn-secondary';
      addEmpIdBtn.style.color = '#b32b2b';
      addEmpIdBtn.style.borderColor = '#b32b2b';
      addEmpIdBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Add Emp ID`;
      addEmpIdBtn.addEventListener('click', () => {
        addQuestion(questionsList, {text: 'Emp ID', type: 'text', required: true}, 'empid');
        addEmpIdBtn.style.display = 'none'; 
      });
      actionsRow.appendChild(addEmpIdBtn);

      const addEmailBtn = document.createElement('button');
      addEmailBtn.className = 'btn-secondary';
      addEmailBtn.style.color = '#0284c7'; 
      addEmailBtn.style.borderColor = '#0284c7';
      addEmailBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Add Email ID`;
      addEmailBtn.addEventListener('click', () => {
        addQuestion(questionsList, {text: 'Email ID', type: 'text', required: true}, 'email');
        addEmailBtn.style.display = 'none';
      });
      actionsRow.appendChild(addEmailBtn);
    }
    
    sectionDiv.appendChild(headerDiv);
    sectionDiv.appendChild(questionsList);
    sectionDiv.appendChild(actionsRow);
    
    editFormBuilderContainer.appendChild(sectionDiv);
    updateSectionNumbers();

    // Populate existing questions
    if (sectionData && sectionData.questions) {
      let currentSubCard = null;
      let currentSubKey = null;

      sectionData.questions.forEach(qData => {
        const isCond = Boolean(qData.depends_on_question_id && qData.depends_on_value);
        const subKey = isCond ? `${qData.depends_on_question_id}||${qData.depends_on_value}||${qData.sub_section_name || ''}` : null;

        if (isCond) {
          if (currentSubCard && currentSubKey === subKey) {
            const subQList = currentSubCard.querySelector('.sub-section-questions-list');
            addQuestion(subQList, qData);
          } else {
            currentSubCard = addConditionalSubSection(questionsList, {
              title: qData.sub_section_name || '',
              parentQuestionId: qData.depends_on_question_id,
              parentValue: qData.depends_on_value
            });
            currentSubKey = subKey;
            const subQList = currentSubCard.querySelector('.sub-section-questions-list');
            addQuestion(subQList, qData);
          }
        } else {
          currentSubCard = null;
          currentSubKey = null;
          addQuestion(questionsList, qData);
        }
      });
      
      // Hide buttons if already present in loaded data
      if (editFormBuilderContainer.children.length === 1) { // We just added section-1
         const hasReg = sectionData.questions.some(q => q.text.toLowerCase().includes('register no'));
         const hasEmp = sectionData.questions.some(q => q.text.toLowerCase().includes('emp id'));
         const hasEmail = sectionData.questions.some(q => q.text.toLowerCase().includes('email id'));
         const btns = actionsRow.querySelectorAll('.btn-secondary');
         btns.forEach(b => {
             if (hasReg && b.innerHTML.includes('Register No')) b.style.display = 'none';
             if (hasEmp && b.innerHTML.includes('Emp ID')) b.style.display = 'none';
             if (hasEmail && b.innerHTML.includes('Email ID')) b.style.display = 'none';
         });
      }
    }
  }

  // --- CONDITIONAL SUB-SECTION LOGIC (EDIT FORM) ---
  function getEligibleParentQuestions(currentSubSection) {
    const eligible = [];
    const allQuestions = Array.from(editFormBuilderContainer.querySelectorAll('.builder-question-card'));
    
    for (const qCard of allQuestions) {
      if (currentSubSection.contains(qCard)) continue;

      const pos = qCard.compareDocumentPosition(currentSubSection);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        const typeSelect = qCard.querySelector('.q-type-select');
        const optInput = qCard.querySelector('.q-optionset-input');
        const titleInput = qCard.querySelector('.q-title-input');
        
        const qText = titleInput ? titleInput.value.trim() : '';
        const qType = typeSelect ? typeSelect.value : '';
        const optSet = optInput ? optInput.value.trim() : '';
        const qId = qCard.dataset.questionId || '';
        const clientUid = qCard.dataset.clientUid || ('quid_' + Math.random().toString(36).substr(2, 9));

        if ((qType === 'optionset' || qType === 'rating' || qType === 'linear_scale') && optSet) {
          eligible.push({
            id: qId,
            uid: clientUid,
            text: qText || '(Untitled Question)',
            optionSet: optSet
          });
        }
      }
    }
    return eligible;
  }

  function refreshParentQuestionOptions(subSectionCard, selectEl, valSelectEl, preselectedParentId = null) {
    const currentVal = selectEl.value || (preselectedParentId ? String(preselectedParentId) : '');
    const eligible = getEligibleParentQuestions(subSectionCard);

    selectEl.innerHTML = '<option value="">-- Select Parent Question --</option>';
    eligible.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id ? String(item.id) : item.uid;
      opt.dataset.clientUid = item.uid;
      opt.dataset.questionId = item.id || '';
      opt.textContent = `${item.text} [${item.optionSet}]`;
      opt.dataset.optionSet = item.optionSet;
      selectEl.appendChild(opt);
    });

    if (currentVal && Array.from(selectEl.options).some(o => o.value === String(currentVal) || o.dataset.clientUid === String(currentVal) || o.dataset.questionId === String(currentVal))) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = '';
      if (valSelectEl && !valSelectEl.dataset.preselected) {
        valSelectEl.innerHTML = '<option value="">-- Select Matching Option --</option>';
      }
    }
  }

  function populateMatchingValues(selectEl, valSelectEl, preselectedVal = null) {
    const selectedVal = selectEl.value;
    valSelectEl.innerHTML = '<option value="">-- Select Matching Option --</option>';
    if (!selectedVal) return;

    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    const optSetName = selectedOpt ? selectedOpt.dataset.optionSet : '';
    if (!optSetName) return;

    const group = optionsData.find(g => g.group_name === optSetName);
    if (group && group.options) {
      group.options.forEach(choice => {
        const opt = document.createElement('option');
        opt.value = choice.label;
        opt.textContent = choice.label;
        valSelectEl.appendChild(opt);
      });
    }

    if (preselectedVal) {
      valSelectEl.value = preselectedVal;
    }
  }

  function addConditionalSubSection(container, subData = null) {
    const subCard = document.createElement('div');
    subCard.className = 'builder-sub-section-card';
    subCard.dataset.subSectionId = 'sub_' + Math.random().toString(36).substr(2, 9);

    const header = document.createElement('div');
    header.className = 'sub-section-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'sub-section-title-row';

    const badgeAndTitle = document.createElement('div');
    badgeAndTitle.style.display = 'flex';
    badgeAndTitle.style.alignItems = 'center';
    badgeAndTitle.style.gap = '10px';
    badgeAndTitle.style.flex = '1';

    const badge = document.createElement('span');
    badge.className = 'sub-section-badge';
    badge.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg> Conditional Block`;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'form-control sub-section-title-input';
    titleInput.placeholder = 'Sub-Section Title (e.g. Hostel Feedback)';
    titleInput.style.maxWidth = '360px';
    titleInput.style.fontWeight = '600';
    if (subData && subData.title) {
      titleInput.value = subData.title;
    }

    badgeAndTitle.appendChild(badge);
    badgeAndTitle.appendChild(titleInput);

    const delSubBtn = document.createElement('button');
    delSubBtn.className = 'btn-danger-outline';
    delSubBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Sub-Section`;
    delSubBtn.addEventListener('click', () => {
      subCard.remove();
    });

    titleRow.appendChild(badgeAndTitle);
    titleRow.appendChild(delSubBtn);

    const ruleRow = document.createElement('div');
    ruleRow.className = 'sub-section-rule-row';

    const ruleLabel = document.createElement('strong');
    ruleLabel.innerHTML = `<svg width="14" height="14" fill="none" stroke="#7c3aed" viewBox="0 0 24 24" style="vertical-align: -2px; margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Show this block when:`;

    const parentQSelect = document.createElement('select');
    parentQSelect.className = 'form-control sub-parent-q-select';

    const equalsSpan = document.createElement('span');
    equalsSpan.textContent = 'equals';
    equalsSpan.style.fontWeight = '600';
    equalsSpan.style.color = '#7c3aed';

    const parentValSelect = document.createElement('select');
    parentValSelect.className = 'form-control sub-parent-val-select';
    parentValSelect.innerHTML = '<option value="">-- Select Matching Option --</option>';

    const refreshDropdown = () => {
      refreshParentQuestionOptions(subCard, parentQSelect, parentValSelect);
    };
    parentQSelect.addEventListener('focus', refreshDropdown);
    parentQSelect.addEventListener('click', refreshDropdown);

    parentQSelect.addEventListener('change', () => {
      populateMatchingValues(parentQSelect, parentValSelect);
    });

    ruleRow.appendChild(ruleLabel);
    ruleRow.appendChild(parentQSelect);
    ruleRow.appendChild(equalsSpan);
    ruleRow.appendChild(parentValSelect);

    header.appendChild(titleRow);
    header.appendChild(ruleRow);

    const subQuestionsList = document.createElement('div');
    subQuestionsList.className = 'sub-section-questions-list';

    const addSubQBtn = document.createElement('button');
    addSubQBtn.type = 'button';
    addSubQBtn.className = 'btn-add-sub-question';
    addSubQBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Add Question to this Sub-Section`;
    addSubQBtn.addEventListener('click', () => {
      const existingCards = subQuestionsList.querySelectorAll('.builder-question-card');
      for (let i = 0; i < existingCards.length; i++) {
        const input = existingCards[i].querySelector('.q-title-input');
        if (input && input.value.trim() === '') {
           showInlineError(input, "Please enter the question text before adding another question.");
           input.focus();
           return;
        }
      }
      addQuestion(subQuestionsList);
    });

    subCard.appendChild(header);
    subCard.appendChild(subQuestionsList);
    subCard.appendChild(addSubQBtn);

    container.appendChild(subCard);

    // Initial populate & preselect if subData provided
    refreshParentQuestionOptions(subCard, parentQSelect, parentValSelect, subData ? subData.parentQuestionId : null);
    if (subData && subData.parentQuestionId) {
      parentQSelect.value = String(subData.parentQuestionId);
      populateMatchingValues(parentQSelect, parentValSelect, subData.parentValue);
    }

    if (!subData) {
      addQuestion(subQuestionsList);
    }

    return subCard;
  }

  function addQuestion(container, qData = null, forceCompulsoryType = false) {
    const qCard = document.createElement('div');
    qCard.className = 'builder-question-card';
    qCard.dataset.questionId = qData && qData.question_id ? qData.question_id : '';
    qCard.dataset.clientUid = qData && qData.question_id ? ('qid_' + qData.question_id) : ('quid_' + Math.random().toString(36).substr(2, 9));
    
    // Check if compulsory (Register No or Email)
    let isCompulsory = forceCompulsoryType;
    if (!isCompulsory && qData && qData.text) {
       if (qData.text.toLowerCase().includes('register no')) isCompulsory = 'register';
       else if (qData.text.toLowerCase().includes('emp id')) isCompulsory = 'empid';
       else if (qData.text.toLowerCase().includes('email id')) isCompulsory = 'email';
    }
    
    if (isCompulsory) {
       qCard.classList.add('compulsory');
    }
    
    const isArchived = qData && qData.active === false;
    if (isArchived) {
       qCard.style.opacity = '0.7'; // Visual indicator
       // Removed pointer-events: none so that the delete button can be clicked
    }

    const header = document.createElement('div');
    header.className = 'question-card-header';
    
    const label = document.createElement('strong');
    label.style.fontSize = '14px';
    label.style.color = 'var(--text-secondary)';
    label.textContent = isCompulsory ? 'Compulsory Question' : 'Question';
    
    // Removing the cross button as requested. Soft delete via toggle is the only way to delete.
    const delBtn = document.createElement('button');
    delBtn.style.display = 'none'; // Hidden permanently

    if(isCompulsory) {
       delBtn.addEventListener('click', () => {
         qCard.remove();
         const section = container.closest('.builder-section');
         if(section && section.id === 'edit-section-1') {
            const btns = section.querySelectorAll('.btn-secondary');
            btns.forEach(b => { 
                if(isCompulsory === 'register' && b.innerHTML.includes('Register No')) b.style.display = 'inline-flex';
                if(isCompulsory === 'empid' && b.innerHTML.includes('Emp ID')) b.style.display = 'inline-flex';
                if(isCompulsory === 'email' && b.innerHTML.includes('Email ID')) b.style.display = 'inline-flex';
            });
         }
       });
       delBtn.title = "Remove Compulsory Question";
    } else {
       delBtn.addEventListener('click', () => qCard.remove());
    }

    header.appendChild(label);
    // header.appendChild(delBtn); // Do not append to DOM

    // Row 1: Text & Required
    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '16px';
    row1.style.marginBottom = '16px';
    row1.style.alignItems = 'center';

    const qInputWrapper = document.createElement('div');
    qInputWrapper.className = 'form-group';
    qInputWrapper.style.flex = '1';
    qInputWrapper.style.position = 'relative';
    
    const qInput = document.createElement('input');
    qInput.type = 'text';
    qInput.className = 'form-control q-title-input';
    qInput.placeholder = 'Question Title';
    if (qData && qData.text) qInput.value = qData.text;
    else if (isCompulsory) {
       if (isCompulsory === 'email') qInput.value = 'Email ID';
       else if (isCompulsory === 'empid') qInput.value = 'Emp ID';
       else qInput.value = 'Register No';
    }
    
    qInput.setAttribute('data-old-val', qInput.value.trim());
    
    qInputWrapper.appendChild(qInput);
    
    qInput.addEventListener('change', function() {
        this.setAttribute('data-old-val', this.value.trim());
    });

    if (qData && qData.question_id && !isCompulsory && !isArchived) {
       qInput.readOnly = true;
       qInput.style.backgroundColor = '#f1f5f9';
       qInput.style.paddingRight = '36px';
       
       const editTitleBtn = document.createElement('button');
       editTitleBtn.type = 'button';
       editTitleBtn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>';
       editTitleBtn.style.position = 'absolute';
       editTitleBtn.style.right = '8px';
       editTitleBtn.style.top = '50%';
       editTitleBtn.style.transform = 'translateY(-50%)';
       editTitleBtn.style.background = 'transparent';
       editTitleBtn.style.border = 'none';
       editTitleBtn.style.color = 'var(--text-secondary)';
       editTitleBtn.style.cursor = 'pointer';
       editTitleBtn.style.padding = '4px';
       editTitleBtn.title = 'Edit Question Title';
       
       editTitleBtn.addEventListener('click', () => {
         Swal.fire({
            title: 'Are you sure?',
            html: `Editing an existing question can be risky.<br><br><span style="color: #d33; font-weight: bold;">Warning: Modifying this will break analytics scoring for existing responses if the meaning changes. It is recommended to deactivate this question and create a new one instead.</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, enable editing'
         }).then((result) => {
            if (result.isConfirmed) {
               qInput.readOnly = false;
               qInput.style.backgroundColor = '';
               qInput.focus();
               editTitleBtn.style.display = 'none';
            }
         });
       });
       qInputWrapper.appendChild(editTitleBtn);
    } else if (isCompulsory || isArchived) {
       qInput.readOnly = true;
    }

    const reqWrapper = document.createElement('div');
    reqWrapper.style.display = 'flex';
    reqWrapper.style.alignItems = 'center';
    reqWrapper.style.gap = '8px';
    
    const reqLabel = document.createElement('label');
    reqLabel.textContent = 'Required';
    reqLabel.style.fontSize = '14px';
    reqLabel.style.fontWeight = '500';
    
    const reqToggle = document.createElement('label');
    reqToggle.className = 'toggle-switch';
    const reqCheckbox = document.createElement('input');
    reqCheckbox.type = 'checkbox';
    reqCheckbox.className = 'q-required-checkbox';
    reqCheckbox.checked = qData ? qData.required : true;
    if (isCompulsory || isArchived) reqCheckbox.disabled = true;
    

    
    const reqSlider = document.createElement('span');
    reqSlider.className = 'toggle-slider';
    
    reqToggle.appendChild(reqCheckbox);
    reqToggle.appendChild(reqSlider);
    reqWrapper.appendChild(reqLabel);
    reqWrapper.appendChild(reqToggle);

    const filterWrapper = document.createElement('div');
    filterWrapper.style.display = 'flex';
    filterWrapper.style.alignItems = 'center';
    filterWrapper.style.gap = '8px';
      
    const filterLabel = document.createElement('label');
    filterLabel.textContent = 'Use as Filter';
    filterLabel.style.fontSize = '14px';
    filterLabel.style.fontWeight = '500';
      
    const filterToggle = document.createElement('label');
    filterToggle.className = 'toggle-switch';
    const filterCheckbox = document.createElement('input');
    filterCheckbox.type = 'checkbox';
    filterCheckbox.className = 'q-filter-checkbox';
    filterCheckbox.checked = qData ? qData.is_filter : false;
    if (isCompulsory || isArchived) filterCheckbox.disabled = true;
      

      
    const filterSlider = document.createElement('span');
    filterSlider.className = 'toggle-slider';
      
    filterToggle.appendChild(filterCheckbox);
    filterToggle.appendChild(filterSlider);
    filterWrapper.appendChild(filterLabel);
    filterWrapper.appendChild(filterToggle);

    const activeWrapper = document.createElement('div');
    activeWrapper.style.display = 'flex';
    activeWrapper.style.alignItems = 'center';
    activeWrapper.style.gap = '8px';
      
    const activeLabel = document.createElement('label');
    activeLabel.textContent = 'Active';
    activeLabel.style.fontSize = '14px';
    activeLabel.style.fontWeight = '500';
      
    const activeToggle = document.createElement('label');
    activeToggle.className = 'toggle-switch';
    const activeCheckbox = document.createElement('input');
    activeCheckbox.type = 'checkbox';
    activeCheckbox.className = 'q-active-checkbox';
    activeCheckbox.checked = qData && qData.active !== undefined ? qData.active : true;
    if (isCompulsory || isArchived) activeCheckbox.disabled = true;
      
    const activeSlider = document.createElement('span');
    activeSlider.className = 'toggle-slider';
      
    activeToggle.appendChild(activeCheckbox);
    activeToggle.appendChild(activeSlider);
    activeWrapper.appendChild(activeLabel);
    activeWrapper.appendChild(activeToggle);
    
    // Logic for toggling active state and moving between sections
    activeCheckbox.addEventListener('change', function() {
        const archivedList = document.getElementById('archived-sidebar-list');
        if (!this.checked) {
            archivedList.appendChild(qCard);
            if (permDelBtn) permDelBtn.style.display = 'block';
        } else {
            if (permDelBtn) permDelBtn.style.display = 'none';
            if (qCard.originalContainer) {
                qCard.originalContainer.appendChild(qCard);
            }
        }
        updateArchiveBadge();
    });
  
    row1.appendChild(qInputWrapper);
    row1.appendChild(filterWrapper);
    row1.appendChild(activeWrapper);
    row1.appendChild(reqWrapper);

    // Row 2: Answer Type
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.gap = '16px';
    row2.style.alignItems = 'flex-start';
    row2.style.flexWrap = 'wrap';

    const typeWrapper = document.createElement('div');
    typeWrapper.className = 'form-group';
    typeWrapper.style.minWidth = '200px';
    
    const typeSelect = document.createElement('select');
    typeSelect.className = 'form-control q-type-select';
    
    const optText = document.createElement('option'); optText.value = 'text'; optText.textContent = 'Short Text';
    const optTextarea = document.createElement('option'); optTextarea.value = 'textarea'; optTextarea.textContent = 'Long Text (Textarea)';
    const optOptionSet = document.createElement('option'); optOptionSet.value = 'optionset'; optOptionSet.textContent = 'Option Set (Single / Multiple Choice)';
    const optRating = document.createElement('option'); optRating.value = 'rating'; optRating.textContent = 'Rating Scale';
    const optLinearScale = document.createElement('option'); optLinearScale.value = 'linear_scale'; optLinearScale.textContent = 'Linear Scale (Rating Matrix)';
    
    typeSelect.appendChild(optText);
    typeSelect.appendChild(optTextarea);
    typeSelect.appendChild(optOptionSet);
    typeSelect.appendChild(optRating);
    typeSelect.appendChild(optLinearScale);
    
    if (qData && qData.type) {
       typeSelect.value = qData.type;
    } else {
       typeSelect.value = 'optionset';
    }
    if (isCompulsory || isArchived) typeSelect.disabled = true;
    
    typeWrapper.appendChild(typeSelect);

    const optSetSettings = document.createElement('div');
    optSetSettings.style.display = (typeSelect.value === 'optionset' || typeSelect.value === 'rating' || typeSelect.value === 'linear_scale') ? 'flex' : 'none';
    optSetSettings.style.gap = '16px';
    optSetSettings.style.flex = '1';
    optSetSettings.style.flexWrap = 'wrap';

    const optWrapper = document.createElement('div');
    optWrapper.className = 'form-group autocomplete-wrapper';
    optWrapper.style.flex = '1';
    
    const optInput = document.createElement('input');
    optInput.type = 'text';
    optInput.className = 'form-control q-optionset-input';
    optInput.placeholder = 'Search Option Set...';
    
    // Set value if existing
    if (qData && qData.option_set) {
       optInput.value = optionIdToName[qData.option_set] || qData.option_set;
    }
    if (isArchived) optInput.readOnly = true;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    
    optWrapper.appendChild(optInput);
    optWrapper.appendChild(dropdown);

    const renderTypeWrapper = document.createElement('div');
    renderTypeWrapper.className = 'form-group';
    renderTypeWrapper.style.minWidth = '180px';
    
    const renderSelect = document.createElement('select');
    renderSelect.className = 'form-control q-render-select';

    function updateRenderSelectOptions(typeVal, currentRenderVal = '') {
      renderSelect.innerHTML = '';
      if (typeVal === 'linear_scale') {
        const optRadioGrid = document.createElement('option');
        optRadioGrid.value = 'radio_grid';
        optRadioGrid.textContent = 'Multiple Choice Grid (Radio)';

        const optCheckboxGrid = document.createElement('option');
        optCheckboxGrid.value = 'checkbox_grid';
        optCheckboxGrid.textContent = 'Checkbox Grid (Multi-Select)';

        const optSliderGrid = document.createElement('option');
        optSliderGrid.value = 'slider_grid';
        optSliderGrid.textContent = 'Slider Grid (Interactive Slider)';

        renderSelect.appendChild(optRadioGrid);
        renderSelect.appendChild(optCheckboxGrid);
        renderSelect.appendChild(optSliderGrid);

        if (['radio_grid', 'checkbox_grid', 'slider_grid'].includes(currentRenderVal)) {
          renderSelect.value = currentRenderVal;
        } else {
          renderSelect.value = 'radio_grid';
        }
      } else {
        const renderDropdown = document.createElement('option');
        renderDropdown.value = 'dropdown';
        renderDropdown.textContent = 'Dropdown List';

        const renderCheckbox = document.createElement('option');
        renderCheckbox.value = 'checkbox';
        renderCheckbox.textContent = 'Checkboxes (Multiple Select)';

        const renderRadio = document.createElement('option');
        renderRadio.value = 'radio';
        renderRadio.textContent = 'Radio Buttons (Single choice)';

        renderSelect.appendChild(renderDropdown);
        renderSelect.appendChild(renderCheckbox);
        renderSelect.appendChild(renderRadio);

        if (['dropdown', 'checkbox', 'radio'].includes(currentRenderVal)) {
          renderSelect.value = currentRenderVal;
        } else {
          renderSelect.value = 'dropdown';
        }
      }
    }

    const initialType = (qData && qData.type) ? qData.type : typeSelect.value;
    const initialRender = (qData && qData.render_type) ? qData.render_type : '';
    updateRenderSelectOptions(initialType, initialRender);

    if (isArchived) renderSelect.disabled = true;
    renderTypeWrapper.appendChild(renderSelect);
    


    optSetSettings.appendChild(optWrapper);
    optSetSettings.appendChild(renderTypeWrapper);

    // Text Settings
    const textSettings = document.createElement('div');
    textSettings.style.display = 'none';
    textSettings.style.gap = '16px';
    textSettings.style.flex = '1';
    textSettings.style.flexWrap = 'wrap';

    const ruleWrapper = document.createElement('div');
    ruleWrapper.className = 'form-group rule-wrapper';
    ruleWrapper.style.minWidth = '150px';
    
    const ruleSelect = document.createElement('select');
    ruleSelect.className = 'form-control q-validation-select';
    const ruleAlphaNum = document.createElement('option'); ruleAlphaNum.value = 'alphanumeric'; ruleAlphaNum.textContent = 'Alphanumeric';
    const ruleNumeric = document.createElement('option'); ruleNumeric.value = 'numeric'; ruleNumeric.textContent = 'Numeric';
    const ruleAlphabet = document.createElement('option'); ruleAlphabet.value = 'alphabet'; ruleAlphabet.textContent = 'Alphabet';
    ruleSelect.appendChild(ruleAlphaNum);
    ruleSelect.appendChild(ruleNumeric);
    ruleSelect.appendChild(ruleAlphabet);
    
    if (qData && qData.validation_type) {
        ruleSelect.value = qData.validation_type;
    }
    
    ruleWrapper.appendChild(ruleSelect);



    const lenWrapper = document.createElement('div');
    lenWrapper.className = 'form-group len-wrapper';
    lenWrapper.style.minWidth = '150px';
    
    const lenInput = document.createElement('input');
    lenInput.type = 'number';
    lenInput.min = '1';
    lenInput.className = 'form-control q-maxlength-input';
    lenInput.placeholder = 'Max Length';
    
    if (qData && qData.max_length) {
        lenInput.value = qData.max_length;
    }
    
    lenWrapper.appendChild(lenInput);
    


    if (isCompulsory || isArchived) {
       ruleSelect.disabled = true;
       lenInput.disabled = true;
    }

    if (isCompulsory === 'register') {
       ruleSelect.value = 'alphanumeric';
       lenInput.value = '10';
    } else if (isCompulsory === 'empid') {
       ruleSelect.value = 'numeric';
       lenInput.value = '5';
    } else if (isCompulsory === 'email') {
       ruleSelect.value = 'alphanumeric';
       lenInput.value = '50';
    }

    textSettings.appendChild(ruleWrapper);
    textSettings.appendChild(lenWrapper);

    row2.appendChild(typeWrapper);
    row2.appendChild(optSetSettings);
    row2.appendChild(textSettings);

    typeSelect.addEventListener('change', function() {
      if (this.value === 'optionset' || this.value === 'rating' || this.value === 'linear_scale') {
        optSetSettings.style.display = 'flex';
        if (this.value === 'rating') {
          renderTypeWrapper.style.display = 'none';
        } else {
          renderTypeWrapper.style.display = 'block';
          updateRenderSelectOptions(this.value);
        }
        textSettings.style.display = 'none';
        if (this.value === 'rating' || this.value === 'linear_scale') {
           optInput.placeholder = 'Search Option Group (e.g. 3-Point, Yes/No, Scale)...';
        } else {
           optInput.placeholder = 'Search Option Set...';
        }
        optInput.value = ''; // clear on switch
      } else if (typeSelect.value === 'text' || typeSelect.value === 'textarea') {
        optSetSettings.style.display = 'none';
        textSettings.style.display = 'flex';
        ruleWrapper.style.display = (typeSelect.value === 'text') ? 'block' : 'none';
        if (isCompulsory === 'email') {
            lenInput.value = '50';
        } else if (isCompulsory === 'register') {
            lenInput.value = '10';
        } else if (isCompulsory === 'empid') {
            lenInput.value = '5';
        } else {
            lenInput.value = (typeSelect.value === 'text') ? '250' : '2000';
        }
      } else {
        optSetSettings.style.display = 'none';
        textSettings.style.display = 'none';
      }
    });

    // Initialize display state
    if (typeSelect.value === 'rating' || typeSelect.value === 'linear_scale') {
        renderTypeWrapper.style.display = 'none';
        optInput.placeholder = 'Search Rating Scale (e.g. 5-Point)...';
    }

    // Autocomplete
    optInput.addEventListener('input', function() {
      const val = this.value.toLowerCase();
      dropdown.innerHTML = '';
      
      // For rating/linear_scale: show all groups that have selectable options (exclude textarea-only groups)
      // For optionset: show all groups
      // In both cases, filter by whatever the user typed
      let matches = optionsData.filter(opt => Array.isArray(opt.options) && opt.options.length > 0);
      
      if (val) {
          matches = matches.filter(opt => opt.group_name.toLowerCase().includes(val));
      }
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const item = document.createElement('div');
          item.className = 'autocomplete-item';
          item.textContent = match.group_name;

          item.addEventListener('mouseenter', () => {
             clearTimeout(previewTimeout);
             if (match.options && match.options.length > 0) {
                 const optionsList = match.options.map(opt => `<li style="margin-bottom: 4px;">${opt.label}</li>`).join('');
                 globalPreviewBox.innerHTML = `
                    <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--text-main); border-bottom: 1px solid var(--input-border); padding-bottom: 4px;">Options Preview</h4>
                    <ul style="margin:0; padding-left:20px; font-size:12px; color:var(--text-secondary);">
                      ${optionsList}
                    </ul>`;
                 globalPreviewBox.style.display = 'block';
                 
                 const dropdownRect = dropdown.getBoundingClientRect();
                 const itemRect = item.getBoundingClientRect();
                 
                 let leftPos = dropdownRect.right + 10;
                 if (leftPos + 250 > window.innerWidth) {
                     leftPos = dropdownRect.left - 260; // Show on left if no space
                 }
                 
                 globalPreviewBox.style.left = leftPos + 'px';
                 globalPreviewBox.style.top = itemRect.top + 'px';
             }
          });
          
          item.addEventListener('mouseleave', () => {
             previewTimeout = setTimeout(() => {
                globalPreviewBox.style.display = 'none';
             }, 250);
          });

          item.addEventListener('click', () => {
            optInput.value = match.group_name;
            dropdown.classList.remove('show');
            globalPreviewBox.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
        dropdown.classList.add('show');
      } else {
        dropdown.classList.remove('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!optWrapper.contains(e.target)) dropdown.classList.remove('show');
    });

    optInput.addEventListener('focus', function() {
      // Trigger input event to populate and show dropdown
      this.dispatchEvent(new Event('input'));
    });

    qCard.appendChild(header);
    qCard.appendChild(row1);
    qCard.appendChild(row2);
    qCard.originalContainer = container;
    
    let targetContainer = container;
    const archivedList = document.getElementById('archived-sidebar-list');
    
    if (!activeCheckbox.checked) {
        targetContainer = archivedList;
    }

    // Add permanent delete button for archived state
    const permDelBtn = document.createElement('button');
    permDelBtn.className = 'btn-danger-outline perm-del-btn';
    permDelBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Permanently Delete';
    permDelBtn.style.display = isArchived ? 'block' : 'none'; // hidden by default unless already archived
    permDelBtn.style.marginTop = '16px';
    permDelBtn.style.width = '100%';
    permDelBtn.style.justifyContent = 'center';
    
    permDelBtn.addEventListener('click', function() {
        const qId = qCard.dataset.questionId;
        const currentTitle = qInput.value.trim();
        Swal.fire({
            title: 'Permanently Delete?',
            text: "This will permanently delete this question AND all its answers from previous responses. This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                if (qId) {
                    Swal.showLoading();
                    fetch('edit_form/delete_question.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question_id: qId, form_id: currentFormId })
                    }).then(res => res.json()).then(data => {
                        Swal.close();
                        if (data.success) {
                            qCard.remove();
                            updateArchiveBadge();
                            Swal.fire('Deleted!', 'Question deleted permanently.', 'success');
                        } else {
                            Swal.fire('Error', data.message || 'Could not delete question.', 'error');
                        }
                    }).catch(err => {
                        Swal.close();
                        Swal.fire('Error', 'Network error occurred.', 'error');
                    });
                } else {
                    // Not saved yet in DB
                    qCard.remove();
                    updateArchiveBadge();
                    Swal.fire('Deleted!', 'Question removed.', 'success');
                }
            }
        });
    });

    qCard.appendChild(permDelBtn);
    
    if (isCompulsory === 'register' && activeCheckbox.checked) {
      targetContainer.insertBefore(qCard, targetContainer.firstChild);
    } else if (isCompulsory === 'email' && activeCheckbox.checked) {
      const firstChild = targetContainer.firstChild;
      let hasRegister = false;
      if (firstChild) {
         const firstInput = firstChild.querySelector('.q-title-input');
         if (firstInput && firstInput.value.includes('Register No')) {
             hasRegister = true;
         }
      }
      if (hasRegister) {
          if (targetContainer.children.length > 1) {
              targetContainer.insertBefore(qCard, targetContainer.children[1]);
          } else {
              targetContainer.appendChild(qCard);
          }
      } else {
          targetContainer.insertBefore(qCard, targetContainer.firstChild);
      }
    } else {
      targetContainer.appendChild(qCard);
    }
    
    // Initialize correct view based on default type or compulsory override
    typeSelect.dispatchEvent(new Event('change'));
    
    // Reset back values if they were provided (dispatchEvent resets them otherwise)
    if (qData && qData.max_length) lenInput.value = qData.max_length;
    if (qData && qData.validation_type) ruleSelect.value = qData.validation_type;
    if (qData && qData.option_set) {
        optInput.value = optionIdToName[qData.option_set] || qData.option_set;
    }
  }

  // --- Save Logic ---
  document.getElementById('update-form-btn')?.addEventListener('click', () => {
    const sections = editFormBuilderContainer.querySelectorAll('.builder-section');
    if (sections.length === 0) {
      showInlineError(document.getElementById('update-form-btn'), "Please add at least one section before saving.", 'beforebegin');
      return;
    }

    let isValid = true;
    let errorMessage = "";

    const payload = {
      form_id: currentFormId,
      title: document.getElementById('edit-display-form-title').textContent,
      description: document.getElementById('edit-display-form-desc').textContent,
      sections: []
    };

    sections.forEach((section, index) => {
      const sectionNum = index + 1;
      const sectionTitle = section.querySelector('.builder-section-title').textContent;
      const sectionNameInput = section.querySelector('.section-name-input');
      const sectionName = sectionNameInput ? sectionNameInput.value.trim() : "";
      
      const sectionData = {
        section_num: sectionNum,
        title: sectionTitle,
        section_name: sectionName,
        questions: []
      };

      let questions = Array.from(section.querySelectorAll('.builder-question-card'));
      const archivedCards = document.getElementById('archived-sidebar-list').querySelectorAll('.builder-question-card');
      archivedCards.forEach(card => {
          if (card.originalContainer && section.contains(card.originalContainer)) {
              questions.push(card);
          }
      });
      if (questions.length === 0) {
        isValid = false;
        errorMessage = `Section ${sectionNum} has no questions.`;
      }

      // Validate conditional sub-sections in this section
      const subSections = section.querySelectorAll('.builder-sub-section-card');
      for (let s = 0; s < subSections.length; s++) {
        const sub = subSections[s];
        const pSelect = sub.querySelector('.sub-parent-q-select');
        const vSelect = sub.querySelector('.sub-parent-val-select');
        const tInput = sub.querySelector('.sub-section-title-input');
        const subTitle = tInput && tInput.value.trim() ? `"${tInput.value.trim()}"` : `Block ${s + 1}`;

        if (!pSelect || !pSelect.value) {
          isValid = false;
          errorMessage = `Please select a parent question for Conditional Sub-Section ${subTitle} in Section ${sectionNum}.`;
          if (pSelect) pSelect.focus();
          break;
        }

        if (!vSelect || !vSelect.value) {
          isValid = false;
          errorMessage = `Please select the matching option value for Conditional Sub-Section ${subTitle} in Section ${sectionNum}.`;
          if (vSelect) vSelect.focus();
          break;
        }

        const subQuestions = sub.querySelectorAll('.builder-question-card');
        if (subQuestions.length === 0) {
          isValid = false;
          errorMessage = `Conditional Sub-Section ${subTitle} in Section ${sectionNum} has no questions. Please add at least one question or delete the sub-section.`;
          break;
        }
      }

      questions.forEach((qCard) => {
        const qId = qCard.dataset.questionId || null;
        const qText = qCard.querySelector('.q-title-input').value.trim();
        const qRequired = qCard.querySelector('.q-required-checkbox').checked;
        const qFilter = qCard.querySelector('.q-filter-checkbox').checked;
        const qActive = qCard.querySelector('.q-active-checkbox').checked;
        const qType = qCard.querySelector('.q-type-select').value;
        
        if (!qText) isValid = false;

        const qData = { 
            question_id: qId,
            text: qText, 
            required: qRequired, 
            is_filter: qFilter,
            active: qActive, 
            type: qType 
        };

        if (qType === 'optionset' || qType === 'rating' || qType === 'linear_scale') {
          qData.option_set = qCard.querySelector('.q-optionset-input').value.trim();
          qData.render_type = qCard.querySelector('.q-render-select').value;
          if (!qData.option_set) isValid = false;
        } else if (qType === 'text' || qType === 'textarea') {
          qData.validation_type = qCard.querySelector('.q-validation-select').value;
          qData.max_length = qCard.querySelector('.q-maxlength-input').value.trim();
        }

        // Check if question belongs to a conditional sub-section
        const parentSubSection = qCard.closest('.builder-sub-section-card');
        if (parentSubSection) {
          const pSelect = parentSubSection.querySelector('.sub-parent-q-select');
          const vSelect = parentSubSection.querySelector('.sub-parent-val-select');
          const tInput = parentSubSection.querySelector('.sub-section-title-input');

          qData.client_uid = qCard.dataset.clientUid || ('quid_' + Math.random().toString(36).substr(2, 9));
          qData.depends_on_ref = pSelect && pSelect.value ? pSelect.value : null;
          qData.depends_on_value = vSelect && vSelect.value ? vSelect.value : null;
          qData.sub_section_name = tInput && tInput.value.trim() ? tInput.value.trim() : null;
        } else {
          qData.client_uid = qCard.dataset.clientUid || ('quid_' + Math.random().toString(36).substr(2, 9));
          qData.depends_on_ref = null;
          qData.depends_on_value = null;
          qData.sub_section_name = null;
        }

        sectionData.questions.push(qData);
      });

      payload.sections.push(sectionData);
    });

    if (!isValid) {
      showInlineError(document.getElementById('update-form-btn'), errorMessage || "Please fill all required fields correctly.", 'beforebegin');
      return;
    }

    const removeQrCheckbox = document.getElementById('edit-form-remove-qr');
    if (removeQrCheckbox && removeQrCheckbox.checked) {
      payload.remove_qr = true;
    }

    const btn = document.getElementById('update-form-btn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    const formData = new FormData();
    formData.append('form_data', JSON.stringify(payload));
    
    const qrInput = document.getElementById('edit-form-qr-input');
    if (qrInput && qrInput.files && qrInput.files.length > 0) {
      formData.append('qr_image', qrInput.files[0]);
    }

    fetch('edit_form/update_form.php', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      btn.disabled = false;
      btn.textContent = 'Update Form';
      if(data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Form Updated!',
          text: 'The form structure has been updated successfully.',
          confirmButtonColor: '#b32b2b'
        }).then(() => {
          showListView();
        });
      } else {
        Swal.fire('Error', data.message || 'Failed to update form.', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      btn.disabled = false;
      btn.textContent = 'Update Form';
      Swal.fire('Error', 'A network error occurred while saving.', 'error');
    });
  });

  // --- Archived Sidebar Logic ---
  function updateArchiveBadge() {
    const archivedList = document.getElementById('archived-sidebar-list');
    const badge = document.getElementById('archive-badge');
    const emptyMsg = document.getElementById('archived-sidebar-empty');
    if (!archivedList || !badge) return;
    const count = archivedList.querySelectorAll('.builder-question-card').length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
    if (emptyMsg) emptyMsg.style.display = count > 0 ? 'none' : 'block';
  }

  function closeArchivedSidebar() {
    const sidebar = document.getElementById('archived-sidebar');
    const overlay = document.getElementById('archived-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
  }

  document.getElementById('open-archived-sidebar-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('archived-sidebar');
    const overlay = document.getElementById('archived-sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) {
      overlay.style.display = 'block';
      requestAnimationFrame(() => overlay.classList.add('open'));
    }
  });

  document.getElementById('close-archived-sidebar')?.addEventListener('click', closeArchivedSidebar);
  document.getElementById('archived-sidebar-overlay')?.addEventListener('click', closeArchivedSidebar);
});

// Global filter function for Edit Form search
window.filterEditForms = function () {
  const input = document.getElementById('edit-form-search-input');
  const clearBtn = document.getElementById('clearEditSearch');
  if (!input) return;
  const filter = input.value.toLowerCase();
  if (clearBtn) clearBtn.style.display = filter.length > 0 ? 'block' : 'none';
  const grid = document.getElementById('forms-list-container');
  const cards = grid.querySelectorAll('.form-card-container');

  let visibleCount = 0;
  cards.forEach(card => {
    const titleElem = card.querySelector('.card-bright-title');
    if (!titleElem) return;
    const title = titleElem.textContent.toLowerCase();

    if (title.includes(filter)) {
      card.style.display = '';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  const noMatchMsg = document.getElementById('edit-no-match-msg');
  if (visibleCount === 0 && cards.length > 0) {
    if (!noMatchMsg) {
      const msg = document.createElement('div');
      msg.id = 'edit-no-match-msg';
      msg.className = 'empty-state';
      msg.style.gridColumn = '1 / -1';
      msg.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-secondary);">No forms match your search.</p>';
      grid.appendChild(msg);
    } else {
      noMatchMsg.style.display = 'block';
    }
  } else if (noMatchMsg) {
    noMatchMsg.style.display = 'none';
  }
};

window.clearEditSearchInput = function () {
  const input = document.getElementById('edit-form-search-input');
  if (input) {
    input.value = '';
    window.filterEditForms();
  }
};
