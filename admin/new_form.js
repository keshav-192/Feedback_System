// Form Builder Logic
document.addEventListener("DOMContentLoaded", function() {
  const addSectionBtn = document.getElementById("add-section-btn");
  const formBuilderContainer = document.getElementById("form-builder-container");
  const formSaveActions = document.getElementById("form-save-actions");
  
  if (!addSectionBtn || !formBuilderContainer) return;

  let sectionCount = 0;
  let optionsData = [];
  let previewTimeout;

  let builderOperations = [];

  function recordAdminOperation(op) {
    builderOperations.push(op);
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
      })
      .catch(error => console.error("Error fetching options:", error));
  }
  loadOptionsForBuilder();
  window.addEventListener('optionsUpdated', loadOptionsForBuilder);

  function updateSectionNumbers() {
    const sections = formBuilderContainer.querySelectorAll('.builder-section');
    sectionCount = sections.length;
    sections.forEach((section, index) => {
      const num = index + 1;
      section.id = `section-${num}`;
      const title = section.querySelector('.builder-section-title');
      if (title) {
        title.textContent = `Section ${num}`;
      }
    });
  }

  // --- 2-STEP SETUP LOGIC ---
  const setupView = document.getElementById('form-setup-view');
  const builderView = document.getElementById('form-builder-view');
  const startBtn = document.getElementById('start-building-btn');
  const editSetupBtn = document.getElementById('edit-setup-btn');
  const titleInput = document.getElementById('form-title-input');
  const descInput = document.getElementById('form-desc-input');
  const qrInput = document.getElementById('form-qr-input');
  const qrPreviewImg = document.getElementById('qr-preview-img');
  const qrPreviewContainer = document.getElementById('qr-preview-container');
  const displayTitle = document.getElementById('display-form-title');
  const displayDesc = document.getElementById('display-form-desc');

  if (qrInput) {
    qrInput.addEventListener('change', function(e) {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          qrPreviewImg.src = e.target.result;
          qrPreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        qrPreviewContainer.style.display = 'none';
        qrPreviewImg.src = '';
      }
    });
  }

  if (titleInput) {
    titleInput.addEventListener('blur', function() {
      const title = this.value.trim();
      if (!title) return;
      
      fetch('check_form_title.php?title=' + encodeURIComponent(title))
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            showInlineError(titleInput, "A form with this name already exists.");
            titleInput.style.borderColor = 'var(--error-color)';
            if (startBtn) startBtn.disabled = true;
          } else {
            titleInput.style.borderColor = '';
            if (startBtn) startBtn.disabled = false;
            const err = titleInput.parentNode.querySelector('.inline-error-text');
            if (err) err.remove();
          }
        })
        .catch(err => console.error("Error checking title:", err));
    });

    titleInput.addEventListener('input', function() {
      this.style.borderColor = '';
      if (startBtn) startBtn.disabled = false;
      const err = this.parentNode.querySelector('.inline-error-text');
      if (err) err.remove();
    });
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const title = titleInput.value.trim();
      if (!title) {
        showInlineError(titleInput, "Please enter a Form Title before starting.");
        titleInput.focus();
        return;
      }
      
      // Update display text
      displayTitle.textContent = title;
      const desc = descInput.value.trim();
      if (desc) {
        displayDesc.textContent = desc;
        displayDesc.style.display = 'block';
      } else {
        displayDesc.style.display = 'none';
      }

      // Record setup step completion in operations timeline
      const hasImage = qrInput && qrInput.files && qrInput.files.length > 0;
      recordAdminOperation(`Completed Setup (Desc: ${desc ? 'Yes' : 'No'}, Image: ${hasImage ? 'Yes' : 'No'})`);

      // Switch views
      setupView.style.display = 'none';
      builderView.style.display = 'block';

      // Auto-add first section if empty
      if (formBuilderContainer.children.length === 0) {
        addSectionBtn.click();
      }
    });
  }

  if (editSetupBtn) {
    editSetupBtn.addEventListener('click', () => {
      recordAdminOperation("Returned to Setup (Edit Title/Description)");
      builderView.style.display = 'none';
      setupView.style.display = 'block';
    });
  }
  // --- END SETUP LOGIC ---

  addSectionBtn.addEventListener('click', () => {
    // Validate that all existing sections have at least one question
    const existingSections = formBuilderContainer.querySelectorAll('.builder-section');
    let canAdd = true;
    let errorSection = 0;

    existingSections.forEach((sec, index) => {
      const qList = sec.querySelector('.builder-question-list');
      if (!qList || qList.children.length === 0) {
        canAdd = false;
        errorSection = index + 1;
      }
    });

    if (!canAdd) {
      showInlineError(addSectionBtn, `Please add at least one question to Section ${errorSection} before adding a new section.`, 'afterend');
      return;
    }

    addSection();
    if (formBuilderContainer.children.length > 0) {
      formSaveActions.style.display = 'flex';
    }
  });

  function addSection() {
    const currentSectionNumber = formBuilderContainer.children.length + 1;
    recordAdminOperation(`Added Section ${currentSectionNumber}`);

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
    
    const headerActions = document.createElement('div');
    headerActions.style.display = 'flex';
    headerActions.style.gap = '8px';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-danger-outline';
    deleteBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Section`;
    deleteBtn.addEventListener('click', () => {
      const secTitleElem = sectionDiv.querySelector('.builder-section-title');
      const secName = secTitleElem ? secTitleElem.textContent : 'Unknown Section';
      const formTitleValue = document.getElementById('form-title-input').value.trim();
      
      sectionDiv.remove();
      updateSectionNumbers();
      updateSaveButtonVisibility();

      const remainingSections = formBuilderContainer.children.length;
      recordAdminOperation(`Deleted ${secName} (Remaining: ${remainingSections})`);
    });

    headerActions.appendChild(deleteBtn);
    headerDiv.appendChild(title);
    headerDiv.appendChild(sectionNameInput);
    headerDiv.appendChild(headerActions);
    
    // Actions Row (Add Question, Add Register No)
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '12px';
    actionsRow.style.marginTop = '16px';
    actionsRow.style.marginBottom = '8px';
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
    
    // Special Buttons for Section 1 (only if no sections exist yet)
    if (formBuilderContainer.children.length === 0) {
      const addRegisterBtn = document.createElement('button');
      addRegisterBtn.className = 'btn-secondary';
      addRegisterBtn.style.color = '#b32b2b';
      addRegisterBtn.style.borderColor = '#b32b2b';
      addRegisterBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Add Register No`;
      
      addRegisterBtn.addEventListener('click', () => {
        addQuestion(questionsList, 'register');
        addRegisterBtn.style.display = 'none'; // Only allow adding once
      });
      actionsRow.appendChild(addRegisterBtn);

      const addEmpIdBtn = document.createElement('button');
      addEmpIdBtn.className = 'btn-secondary';
      addEmpIdBtn.style.color = '#b32b2b';
      addEmpIdBtn.style.borderColor = '#b32b2b';
      addEmpIdBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Add Emp ID`;
      
      addEmpIdBtn.addEventListener('click', () => {
        addQuestion(questionsList, 'empid');
        addEmpIdBtn.style.display = 'none'; // Only allow adding once
      });
      actionsRow.appendChild(addEmpIdBtn);

      const addEmailBtn = document.createElement('button');
      addEmailBtn.className = 'btn-secondary';
      addEmailBtn.style.color = '#0284c7'; 
      addEmailBtn.style.borderColor = '#0284c7';
      addEmailBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Add Email ID`;
      
      addEmailBtn.addEventListener('click', () => {
        addQuestion(questionsList, 'email');
        addEmailBtn.style.display = 'none';
      });
      actionsRow.appendChild(addEmailBtn);
    }
    
    sectionDiv.appendChild(headerDiv);
    sectionDiv.appendChild(questionsList);
    sectionDiv.appendChild(actionsRow);
    
    formBuilderContainer.appendChild(sectionDiv);
    updateSectionNumbers(); // Re-number after adding
  }

  // --- CONDITIONAL SUB-SECTION LOGIC ---
  function getEligibleParentQuestions(currentSubSection) {
    const eligible = [];
    const allQuestions = Array.from(formBuilderContainer.querySelectorAll('.builder-question-card'));
    
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

        if ((qType === 'optionset' || qType === 'rating' || qType === 'linear_scale') && optSet) {
          eligible.push({
            uid: qCard.dataset.clientUid,
            text: qText || '(Untitled Question)',
            optionSet: optSet
          });
        }
      }
    }
    return eligible;
  }

  function refreshParentQuestionOptions(subSectionCard, selectEl, valSelectEl) {
    const currentVal = selectEl.value;
    const eligible = getEligibleParentQuestions(subSectionCard);

    selectEl.innerHTML = '<option value="">-- Select Parent Question --</option>';
    eligible.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.uid;
      opt.textContent = `${item.text} [${item.optionSet}]`;
      opt.dataset.optionSet = item.optionSet;
      selectEl.appendChild(opt);
    });

    if (currentVal && eligible.some(e => e.uid === currentVal)) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = '';
      if (valSelectEl) valSelectEl.innerHTML = '<option value="">-- Select Matching Option --</option>';
    }
  }

  function populateMatchingValues(selectEl, valSelectEl) {
    const selectedUid = selectEl.value;
    valSelectEl.innerHTML = '<option value="">-- Select Matching Option --</option>';
    if (!selectedUid) return;

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
  }

  function addConditionalSubSection(container) {
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

    badgeAndTitle.appendChild(badge);
    badgeAndTitle.appendChild(titleInput);

    const delSubBtn = document.createElement('button');
    delSubBtn.className = 'btn-danger-outline';
    delSubBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Sub-Section`;
    delSubBtn.addEventListener('click', () => {
      subCard.remove();
      updateSaveButtonVisibility();
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
    refreshDropdown();
    addQuestion(subQuestionsList);
    updateSaveButtonVisibility();
  }

  function addQuestion(container, compulsoryType = false) {
    const qCard = document.createElement('div');
    qCard.className = 'builder-question-card';
    qCard.dataset.clientUid = 'quid_' + Math.random().toString(36).substr(2, 9);
    if (compulsoryType) qCard.classList.add('compulsory');

    const header = document.createElement('div');
    header.className = 'question-card-header';
    
    const label = document.createElement('strong');
    label.style.fontSize = '14px';
    label.style.color = 'var(--text-secondary)';
    label.textContent = compulsoryType ? 'Compulsory Question' : 'Question';
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger-outline';
    delBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    delBtn.style.padding = '4px';
    delBtn.title = 'Remove Question';
    
    if (compulsoryType) {
       delBtn.addEventListener('click', () => {
         qCard.remove();
         const section = container.closest('.builder-section');
         if(section && section.id === 'section-1') {
            const btns = section.querySelectorAll('.btn-secondary');
            btns.forEach(b => { 
                if((compulsoryType === 'register' || compulsoryType === true) && b.innerHTML.includes('Register No')) b.style.display = 'inline-flex';
                if(compulsoryType === 'empid' && b.innerHTML.includes('Emp ID')) b.style.display = 'inline-flex';
                if(compulsoryType === 'email' && b.innerHTML.includes('Email ID')) b.style.display = 'inline-flex';
            });
         }
       });
    } else {
       delBtn.addEventListener('click', () => qCard.remove());
    }

    header.appendChild(label);
    header.appendChild(delBtn);

    // --- ROW 1: Question Text & Required Toggle ---
    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '16px';
    row1.style.marginBottom = '16px';
    row1.style.alignItems = 'center';

    const qInputWrapper = document.createElement('div');
    qInputWrapper.className = 'form-group';
    qInputWrapper.style.flex = '1';
    
    const qInput = document.createElement('input');
    qInput.type = 'text';
    qInput.className = 'form-control q-title-input';
    qInput.placeholder = 'Enter question text...';
    if (compulsoryType) {
      if (compulsoryType === 'email') qInput.value = 'Email ID';
      else if (compulsoryType === 'empid') qInput.value = 'Emp ID';
      else qInput.value = 'Register No';
      qInput.readOnly = true;
    }
    qInputWrapper.appendChild(qInput);

    const reqWrapper = document.createElement('div');
    reqWrapper.style.display = 'flex';
    reqWrapper.style.alignItems = 'center';
    reqWrapper.style.gap = '8px';
    
    const reqLabel = document.createElement('label');
    reqLabel.textContent = 'Required';
    reqLabel.style.fontSize = '14px';
    reqLabel.style.fontWeight = '500';
    reqLabel.style.color = 'var(--text-main)';
    
    const reqToggle = document.createElement('label');
    reqToggle.className = 'toggle-switch';
    const reqCheckbox = document.createElement('input');
    reqCheckbox.type = 'checkbox';
    reqCheckbox.className = 'q-required-checkbox';
    reqCheckbox.checked = true; // Active by default
    if (compulsoryType) reqCheckbox.disabled = true;
    
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
    filterLabel.style.color = 'var(--text-main)';
    
    const filterToggle = document.createElement('label');
    filterToggle.className = 'toggle-switch';
    const filterCheckbox = document.createElement('input');
    filterCheckbox.type = 'checkbox';
    filterCheckbox.className = 'q-filter-checkbox';
    filterCheckbox.checked = false; // Off by default
    if (compulsoryType) filterCheckbox.disabled = true;
    
    const filterSlider = document.createElement('span');
    filterSlider.className = 'toggle-slider';
    
    filterToggle.appendChild(filterCheckbox);
    filterToggle.appendChild(filterSlider);
    filterWrapper.appendChild(filterLabel);
    filterWrapper.appendChild(filterToggle);

    row1.appendChild(qInputWrapper);
    row1.appendChild(filterWrapper);
    row1.appendChild(reqWrapper);

    // --- ROW 2: Answer Type & Option Set Settings ---
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
    
    // Default to 'optionset'
    typeSelect.value = 'optionset';
    
    if (compulsoryType) {
       typeSelect.value = 'text';
       typeSelect.disabled = true;
    }
    typeWrapper.appendChild(typeSelect);

    // Option Set settings (hidden by default unless optionset is selected)
    const optSetSettings = document.createElement('div');
    optSetSettings.style.display = (typeSelect.value === 'optionset') ? 'flex' : 'none';
    optSetSettings.style.gap = '16px';
    optSetSettings.style.flex = '1';
    optSetSettings.style.flexWrap = 'wrap';

    // 1. Autocomplete Input
    const optWrapper = document.createElement('div');
    optWrapper.className = 'form-group autocomplete-wrapper';
    optWrapper.style.flex = '1';
    optWrapper.style.minWidth = '200px';
    
    const optInput = document.createElement('input');
    optInput.type = 'text';
    optInput.className = 'form-control q-optionset-input';
    optInput.placeholder = 'Search Option Set (e.g. Department)...';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    
    optWrapper.appendChild(optInput);
    optWrapper.appendChild(dropdown);

    // 2. Render As (Dropdown vs Radio/Checkbox vs Grid Sub-types)
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

    updateRenderSelectOptions('optionset');
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
    ruleWrapper.appendChild(ruleSelect);

    ruleSelect.addEventListener('change', function() {
      const qInput = qCard.querySelector('.q-title-input');
      const qName = qInput ? qInput.value.trim() : 'Unknown Question';
      recordAdminOperation(`Changed Validation Type to: ${this.value} for question: ${qName}`);
    });

    const lenWrapper = document.createElement('div');
    lenWrapper.className = 'form-group len-wrapper';
    lenWrapper.style.minWidth = '150px';
    
    const lenInput = document.createElement('input');
    lenInput.type = 'number';
    lenInput.min = '1';
    lenInput.className = 'form-control q-maxlength-input';
    lenInput.placeholder = 'Max Length';
    lenWrapper.appendChild(lenInput);
    
    lenInput.addEventListener('change', function() {
      const qInput = qCard.querySelector('.q-title-input');
      const qName = qInput ? qInput.value.trim() : 'Unknown Question';
      recordAdminOperation(`Changed Max Length to: ${this.value} for question: ${qName}`);
    });

    if (compulsoryType) {
       ruleSelect.disabled = true;
       lenInput.disabled = true;
       if (compulsoryType === 'register') {
          ruleSelect.value = 'alphanumeric';
          lenInput.value = '10';
       } else if (compulsoryType === 'empid') {
          ruleSelect.value = 'numeric';
          lenInput.value = '5';
       } else if (compulsoryType === 'email') {
          ruleSelect.value = 'alphanumeric';
          lenInput.value = '50';
       }
    }

    textSettings.appendChild(ruleWrapper);
    textSettings.appendChild(lenWrapper);

    row2.appendChild(typeWrapper);
    row2.appendChild(optSetSettings);
    row2.appendChild(textSettings);

    // Toggle logic for Row 2
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'optionset' || typeSelect.value === 'rating' || typeSelect.value === 'linear_scale') {
        optSetSettings.style.display = 'flex';
        if (typeSelect.value === 'rating') {
          renderTypeWrapper.style.display = 'none';
        } else {
          renderTypeWrapper.style.display = 'block';
          updateRenderSelectOptions(typeSelect.value);
        }
        textSettings.style.display = 'none';
        if (typeSelect.value === 'rating' || typeSelect.value === 'linear_scale') {
           optInput.placeholder = 'Search Option Group (e.g. 3-Point, Yes/No, Scale)...';
        } else {
           optInput.placeholder = 'Search Option Set (e.g. Department)...';
        }
        optInput.value = ''; // clear on switch
      } else if (typeSelect.value === 'text' || typeSelect.value === 'textarea') {
        optSetSettings.style.display = 'none';
        textSettings.style.display = 'flex';
        ruleWrapper.style.display = (typeSelect.value === 'text') ? 'block' : 'none';
        if (compulsoryType === 'email') {
            lenInput.value = '50';
        } else if (compulsoryType === 'register') {
            lenInput.value = '10';
        } else if (compulsoryType === 'empid') {
            lenInput.value = '5';
        } else {
            lenInput.value = (typeSelect.value === 'text') ? '250' : '2000';
        }
      } else {
        optSetSettings.style.display = 'none';
        textSettings.style.display = 'none';
      }
    });

    // Autocomplete logic
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
      if (!optWrapper.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
    
    optInput.addEventListener('focus', function() {
      this.dispatchEvent(new Event('input'));
    });

    qCard.appendChild(header);
    qCard.appendChild(row1);
    qCard.appendChild(row2);
    
    if (compulsoryType === 'register') {
      container.insertBefore(qCard, container.firstChild);
    } else if (compulsoryType === 'email') {
      const firstChild = container.firstChild;
      let hasRegister = false;
      if (firstChild) {
         const firstInput = firstChild.querySelector('.q-title-input');
         if (firstInput && firstInput.value.includes('Register No')) {
             hasRegister = true;
         }
      }
      if (hasRegister) {
          if (container.children.length > 1) {
              container.insertBefore(qCard, container.children[1]);
          } else {
              container.appendChild(qCard);
          }
      } else {
          container.insertBefore(qCard, container.firstChild);
      }
    } else {
      container.appendChild(qCard);
    }
    
    // Initialize correct view based on default type or compulsory override
    typeSelect.dispatchEvent(new Event('change'));
  }

  function updateSaveButtonVisibility() {
     if(formBuilderContainer.children.length === 0) {
       formSaveActions.style.display = 'none';
     } else {
       formSaveActions.style.display = 'flex';
     }
  }
  
  function generatePayload() {
    const titleInput = document.getElementById('form-title-input');
    const descInput = document.getElementById('form-desc-input');
    
    if (!titleInput || !titleInput.value.trim()) {
      showInlineError(titleInput, "Please enter a Form Title before saving.");
      if (titleInput) titleInput.focus();
      return null;
    }

    const sections = formBuilderContainer.querySelectorAll('.builder-section');
    if (sections.length === 0) {
      showInlineError(document.getElementById('form-save-actions'), "Please add at least one section before saving.", 'beforebegin');
      return null;
    }

    let isValid = true;
    let errorMessage = "";

    // Validate each section and its questions
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionNum = i + 1;
      const questions = section.querySelectorAll('.builder-question-card');
      
      if (questions.length === 0) {
        isValid = false;
        errorMessage = `Section ${sectionNum} has no questions. Please add at least one question or delete the section.`;
        break;
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
      if (!isValid) break;

      for (let j = 0; j < questions.length; j++) {
        const qCard = questions[j];
        const qInput = qCard.querySelector('.q-title-input');
        const typeSelect = qCard.querySelector('.q-type-select');
        
        if (!qInput.value.trim()) {
          isValid = false;
          errorMessage = `Please enter the question text for Question ${j + 1} in Section ${sectionNum}.`;
          qInput.focus();
          break;
        }

        if (typeSelect && (typeSelect.value === 'optionset' || typeSelect.value === 'rating' || typeSelect.value === 'linear_scale')) {
          const optInput = qCard.querySelector('.q-optionset-input');
          if (!optInput.value.trim()) {
            isValid = false;
            const typeLabel = (typeSelect.value === 'rating' || typeSelect.value === 'linear_scale') ? 'Rating Scale' : 'Option Set';
            errorMessage = `Please search and select a ${typeLabel} for Question ${j + 1} in Section ${sectionNum}.`;
            optInput.focus();
            break;
          }
        }
      }
      
      if (!isValid) break;
    }

    if (!isValid) {
      showInlineError(document.getElementById('form-save-actions'), errorMessage, 'beforebegin');
      return null;
    }

    // Extract data to JSON payload
    const payload = {
      title: titleInput.value.trim(),
      description: descInput ? descInput.value.trim() : "",
      sections: []
    };

    sections.forEach((section, index) => {
      const sectionNum = index + 1;
      const sectionTitle = section.querySelector('.builder-section-title').textContent || `Section ${sectionNum}`;
      const sectionNameInput = section.querySelector('.section-name-input');
      const sectionName = sectionNameInput ? sectionNameInput.value.trim() : "";

      const sectionData = {
        section_num: sectionNum,
        title: sectionTitle,
        section_name: sectionName,
        questions: []
      };

      const questions = section.querySelectorAll('.builder-question-card');
      questions.forEach((qCard) => {
        const qText = qCard.querySelector('.q-title-input').value.trim();
        const qRequired = qCard.querySelector('.q-required-checkbox').checked;
        const qFilter = qCard.querySelector('.q-filter-checkbox').checked;
        const qType = qCard.querySelector('.q-type-select').value;
        
        const qData = {
          client_uid: qCard.dataset.clientUid || ('quid_' + Math.random().toString(36).substr(2, 9)),
          text: qText,
          required: qRequired,
          is_filter: qFilter,
          type: qType
        };

        if (qType === 'optionset' || qType === 'rating' || qType === 'linear_scale') {
          qData.option_set = qCard.querySelector('.q-optionset-input').value.trim();
          qData.render_type = qCard.querySelector('.q-render-select').value;
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

          qData.depends_on_client_uid = pSelect && pSelect.value ? pSelect.value : null;
          qData.depends_on_value = vSelect && vSelect.value ? vSelect.value : null;
          qData.sub_section_name = tInput && tInput.value.trim() ? tInput.value.trim() : null;
        } else {
          qData.depends_on_client_uid = null;
          qData.depends_on_value = null;
          qData.sub_section_name = null;
        }

        sectionData.questions.push(qData);
      });

      payload.sections.push(sectionData);
    });

    payload.builder_operations = builderOperations;

    return payload;
  }

  function resetNewFormBuilder() {
    builderOperations = [];
    sectionCount = 0;

    // Reset Title, Description & QR Input fields
    if (titleInput) {
      titleInput.value = '';
      titleInput.style.borderColor = '';
      const err = titleInput.parentNode ? titleInput.parentNode.querySelector('.inline-error-text') : null;
      if (err) err.remove();
    }
    if (descInput) {
      descInput.value = '';
    }
    if (qrInput) {
      qrInput.value = '';
    }
    if (qrPreviewContainer) {
      qrPreviewContainer.style.display = 'none';
    }
    if (qrPreviewImg) {
      qrPreviewImg.src = '';
    }

    // Reset Title/Description Preview Card in builder view
    if (displayTitle) displayTitle.textContent = 'Form Title';
    if (displayDesc) {
      displayDesc.textContent = 'Form Description';
      displayDesc.style.display = 'block';
    }

    // Clear all dynamic sections & questions
    if (formBuilderContainer) {
      formBuilderContainer.innerHTML = '';
    }

    // Remove any save action errors and hide action bar
    if (formSaveActions) {
      const existingErrors = formSaveActions.parentNode ? formSaveActions.parentNode.querySelectorAll('.inline-error-text') : [];
      existingErrors.forEach(e => e.remove());
      formSaveActions.style.display = 'none';
    }

    if (startBtn) {
      startBtn.disabled = false;
    }

    // Switch view back to Step 1 (Setup view)
    if (builderView) builderView.style.display = 'none';
    if (setupView) setupView.style.display = 'block';
  }

  const cancelNewFormBtn = document.getElementById('cancel-new-form-btn');
  if (cancelNewFormBtn) {
    cancelNewFormBtn.addEventListener('click', () => {
      recordAdminOperation("Cancelled New Form (All data cleared)");
      resetNewFormBuilder();
    });
  }
  
  const saveFormBtn = document.getElementById('save-form-btn');
  if(saveFormBtn) {
    saveFormBtn.addEventListener('click', () => {
      const payload = generatePayload();
      if (!payload) return;

      saveFormBtn.disabled = true;
      saveFormBtn.textContent = 'Saving...';

      const formData = new FormData();
      formData.append('form_data', JSON.stringify(payload));
      
      const qrInput = document.getElementById('form-qr-input');
      if (qrInput && qrInput.files && qrInput.files.length > 0) {
        formData.append('qr_image', qrInput.files[0]);
      }

      fetch('save_form.php', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        saveFormBtn.disabled = false;
        saveFormBtn.textContent = 'Save Form';
        
        if(data.success) {
          resetNewFormBuilder();

          Swal.fire({
            icon: 'success',
            title: 'Form Saved!',
            text: 'Your new form is now live on the public dashboard.',
            confirmButtonColor: '#b32b2b',
            timer: 2500,
            timerProgressBar: true
          });
        } else {
          Swal.fire('Error', data.message || 'Failed to save form.', 'error');
        }
      })
      .catch(err => {
        console.error(err);
        Swal.fire('Error', 'A network error occurred while saving.', 'error');
        saveFormBtn.disabled = false;
        saveFormBtn.textContent = 'Save Form';
      });
    });
  }
});
