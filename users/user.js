document.addEventListener('DOMContentLoaded', function () {
  
  // Form interactions and validation setup
  const form = document.getElementById('feedback-form');
  const successModal = document.getElementById('success-modal');
  const modalOkBtn = document.getElementById('modal-ok-btn');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const progressCard = document.getElementById('progress-card');
  
  let currentStep = 1;
  const totalSteps = progressCard ? parseInt(progressCard.getAttribute('data-total-steps'), 10) || 6 : 6;

  // ── User Session Journey Tracking ──────────────────────────────────────────
  const sessionStartTime = Date.now();
  const journeyTrail = ['Opened Form'];
  let isSessionSubmitted = false;

  // Restrict unwanted characters in Long Text (Textarea)
  const textareas = document.querySelectorAll('.textarea-input');
  textareas.forEach(ta => {
    ta.addEventListener('input', function() {
      // Allow: a-z, A-Z, 0-9, spaces/newlines, and basic punctuation
      let val = this.value.replace(/[^a-zA-Z0-9\s.,?!"'()\-&/@]/g, '');
      // Prevent consecutive identical special characters
      val = val.replace(/([.,?!"'()\-&\/@])\1+/g, '$1');
      this.value = val;
    });
  });

  // Restrict unwanted characters in Short Text (Generic)
  const genericTextInputs = document.querySelectorAll('.text-input:not(.register-no-input):not(.emp-id-input):not(.reg-emp-input):not(.email-id-input)');
  genericTextInputs.forEach(input => {
    input.addEventListener('input', function() {
      const vtype = this.getAttribute('data-validation-type');
      let val = this.value;
      if (vtype === 'numeric') {
          val = val.replace(/[^0-9]/g, '');
      } else if (vtype === 'alphabet') {
          val = val.replace(/[^a-zA-Z\s]/g, '');
      } else { // alphanumeric or default
          val = val.replace(/[^a-zA-Z0-9\s.,?!"'()\-&/@]/g, '');
          val = val.replace(/([.,?!"'()\-&\/@])\1+/g, '$1');
      }
      this.value = val;
    });
  });

  // Restrictions for Register No (Alphanumeric only)
  const regInputs = document.querySelectorAll('.register-no-input');
  regInputs.forEach(input => {
    input.addEventListener('input', function() {
      this.value = this.value.replace(/[^a-zA-Z0-9]/g, '');
    });
  });

  // Restrictions for Emp ID (Digits only)
  const empInputs = document.querySelectorAll('.emp-id-input');
  empInputs.forEach(input => {
    input.addEventListener('input', function() {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
  });

  // Restrictions for Register No / Emp ID (Alphanumeric only)
  const regEmpInputs = document.querySelectorAll('.reg-emp-input');
  regEmpInputs.forEach(input => {
    input.addEventListener('input', function() {
      this.value = this.value.replace(/[^a-zA-Z0-9]/g, '');
    });
  });

  // Restrictions for Email ID (Alphanumeric, @, and .)
  const emailInputsJs = document.querySelectorAll('.email-id-input');
  emailInputsJs.forEach(input => {
    input.addEventListener('input', function() {
      let val = this.value.replace(/[^a-zA-Z0-9@.]/g, '');
      // Prevent consecutive identical special characters (@ or .)
      val = val.replace(/([@.])\1+/g, '$1');
      this.value = val;
    });
  });

  // Tracks if user has visited the summary page at least once
  let hasVisitedSummary = false;
  const returnToSummaryBtn = document.getElementById('return-to-summary-btn');

  // Handle checkbox inputs with "Other" option (Dynamic Reveal)
  const checkboxOtherTriggers = document.querySelectorAll('.checkbox-other-trigger, .radio-other-trigger');
  checkboxOtherTriggers.forEach(cb => {
    cb.addEventListener('change', (e) => {
      // For radios, when this changes, other radios in the same group might have been unchecked
      // So we need to handle that, but typically the "Other" radio being checked reveals the box.
      // However, if another radio is clicked, the "change" event fires on THAT radio, not the "Other" radio.
      // So it's better to attach change event to all radios in the group if one of them is an "Other" radio.
    });
  });

  // Better logic for Radio "Other" triggers
  const allRadios = document.querySelectorAll('input[type="radio"]');
  allRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Find if there is an other-trigger in this radio's name group
      const name = radio.name;
      const groupRadios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      let otherTrigger = null;
      groupRadios.forEach(r => {
        if (r.classList.contains('radio-other-trigger')) {
          otherTrigger = r;
        }
      });
      
      if (otherTrigger) {
        const targetId = otherTrigger.getAttribute('data-other-target');
        const targetContainer = document.getElementById(targetId);
        if (targetContainer) {
          const otherInput = targetContainer.querySelector('.other-text-input');
          if (otherTrigger.checked) {
            targetContainer.style.display = 'block';
            if (otherInput) {
              otherInput.focus();
              otherInput.required = true;
            }
          } else {
            targetContainer.style.display = 'none';
            if (otherInput) {
              otherInput.required = false;
            }
          }
        }
      }
    });
  });

  // Keep original checkbox logic
  const onlyCheckboxTriggers = document.querySelectorAll('.checkbox-other-trigger');
  onlyCheckboxTriggers.forEach(cb => {
    cb.addEventListener('change', () => {
      const targetId = cb.getAttribute('data-other-target');
      const targetContainer = document.getElementById(targetId);
      if (targetContainer) {
        const otherInput = targetContainer.querySelector('.other-text-input');
        if (cb.checked) {
          targetContainer.style.display = 'block';
          if (otherInput) {
            otherInput.focus();
            otherInput.required = true;
          }
        } else {
          targetContainer.style.display = 'none';
          if (otherInput) {
            otherInput.required = false;
          }
        }
      }
    });
  });

  // Handle select inputs with "Other" option
  const selectWithOthers = document.querySelectorAll('.select-with-other');
  selectWithOthers.forEach(select => {
    select.addEventListener('change', () => {
      const targetId = select.getAttribute('data-other-target');
      const targetContainer = document.getElementById(targetId);
      if (targetContainer) {
        const otherInput = targetContainer.querySelector('.other-text-input');
        if (select.value.toLowerCase().startsWith('other')) {
          targetContainer.style.display = 'block';
          if (otherInput) {
            otherInput.focus();
            otherInput.required = true;
          }
        } else {
          targetContainer.style.display = 'none';
          if (otherInput) {
            otherInput.required = false;
          }
        }
      }
    });
  });

  // Helper to hide all custom other containers on reset
  function hideAllOtherContainers() {
    selectWithOthers.forEach(select => {
      const targetId = select.getAttribute('data-other-target');
      const targetContainer = document.getElementById(targetId);
      if (targetContainer) {
        targetContainer.style.display = 'none';
        const otherInput = targetContainer.querySelector('.other-text-input');
        if (otherInput) {
          otherInput.value = '';
          otherInput.required = false;
        }
      }
    });
    checkboxOtherTriggers.forEach(cb => {
      const targetId = cb.getAttribute('data-other-target');
      const targetContainer = document.getElementById(targetId);
      if (targetContainer) {
        targetContainer.style.display = 'none';
        const otherInput = targetContainer.querySelector('.other-text-input');
        if (otherInput) {
          otherInput.value = '';
          otherInput.required = false;
        }
      }
    });
  }

  // ── Hierarchical (Cascading) Dropdowns Setup ────────────────────────────────
  function initHierarchicalDropdowns() {
    const childSelects = document.querySelectorAll('select[data-parent-group]');
    if (childSelects.length === 0) return;

    childSelects.forEach(childSelect => {
      const parentGroupName = childSelect.getAttribute('data-parent-group');
      if (!parentGroupName) return;

      // Cache all initial options (skipping the first placeholder)
      const cachedOptions = [];
      Array.from(childSelect.options).forEach((opt, idx) => {
        if (idx === 0 && opt.value === '') return;
        let parents = [];
        const rawParents = opt.getAttribute('data-parents');
        if (rawParents) {
          try {
            parents = JSON.parse(rawParents);
          } catch (e) {
            parents = [];
          }
        }
        cachedOptions.push({
          value: opt.value,
          text: opt.textContent,
          parents: Array.isArray(parents) ? parents : []
        });
      });
      childSelect._cachedOptions = cachedOptions;

      // Find parent element(s): select or radio buttons
      const parentSelects = document.querySelectorAll(`select[data-group-id="${parentGroupName}"]`);
      const parentRadios = document.querySelectorAll(`input[type="radio"][data-group-id="${parentGroupName}"]`);

      function getParentValue() {
        for (let sel of parentSelects) {
          if (sel.value) return sel.value;
        }
        for (let rad of parentRadios) {
          if (rad.checked) return rad.value;
        }
        return '';
      }

      function syncChild() {
        const parentVal = getParentValue();
        const currentChildVal = childSelect.value;
        const card = childSelect.closest('.card');
        childSelect.innerHTML = '';

        if (!parentVal) {
          // Parent not selected: keep disabled and show notice
          childSelect.disabled = true;
          if (card) {
            card.classList.remove('card-error', 'card-not-applicable');
          }
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.disabled = true;
          placeholder.selected = true;
          placeholder.hidden = true;
          placeholder.textContent = 'Choose option';
          childSelect.appendChild(placeholder);

          if (currentChildVal !== '') {
            childSelect.value = '';
            childSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        // Parent selected: filter matching choices
        const matching = childSelect._cachedOptions.filter(opt => {
          if (!opt.parents || opt.parents.length === 0) {
            return true; // universal choice
          }
          return opt.parents.includes(parentVal);
        });

        if (matching.length === 0) {
          // NO CHOICES MATCH: This question is not applicable for the selected parent option!
          childSelect.disabled = true;
          if (card) {
            card.classList.remove('card-error');
            card.classList.add('card-not-applicable');
          }
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.disabled = true;
          placeholder.selected = true;
          placeholder.textContent = `Not applicable for "${parentVal}"`;
          childSelect.appendChild(placeholder);

          if (currentChildVal !== '') {
            childSelect.value = '';
            childSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        // Choices exist: enable child and populate matching options
        childSelect.disabled = false;
        if (card) {
          card.classList.remove('card-not-applicable');
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.hidden = true;
        placeholder.textContent = 'Choose option';
        childSelect.appendChild(placeholder);

        matching.forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.text;
          if (opt.parents && opt.parents.length > 0) {
            optEl.setAttribute('data-parents', JSON.stringify(opt.parents));
          }
          childSelect.appendChild(optEl);
        });

        // Retain previous value if still applicable, otherwise reset
        if (currentChildVal && matching.some(m => m.value === currentChildVal)) {
          childSelect.value = currentChildVal;
        } else {
          childSelect.value = '';
          if (currentChildVal !== '') {
            childSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      parentSelects.forEach(sel => sel.addEventListener('change', syncChild));
      parentRadios.forEach(rad => rad.addEventListener('change', syncChild));

      // Initial synchronization
      syncChild();
    });
  }

  function resetHierarchicalDropdowns() {
    const childSelects = document.querySelectorAll('select[data-parent-group]');
    childSelects.forEach(childSelect => {
      const parentGroupName = childSelect.getAttribute('data-parent-group');
      const card = childSelect.closest('.card');
      if (card) card.classList.remove('card-not-applicable', 'card-error');
      childSelect.disabled = true;
      childSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.hidden = true;
      placeholder.textContent = 'Choose option';
      childSelect.appendChild(placeholder);
      childSelect.value = '';
    });
  }

  initHierarchicalDropdowns();

  // --- CONDITIONAL SUB-SECTIONS RUNTIME ---
  function initConditionalSubSections() {
    const subSections = document.querySelectorAll('.conditional-sub-section');
    if (subSections.length === 0) return;

    function syncAllConditionalSubSections() {
      subSections.forEach(sub => {
        const dependsOnCardId = sub.getAttribute('data-depends-on');
        const expectedVal = sub.getAttribute('data-depends-value');
        if (!dependsOnCardId || !expectedVal) return;

        const parentCard = document.getElementById(dependsOnCardId);
        if (!parentCard) return;

        let parentVal = '';
        const checkedRadio = parentCard.querySelector('input[type="radio"]:checked');
        const select = parentCard.querySelector('select');
        const checkedBoxes = parentCard.querySelectorAll('input[type="checkbox"]:checked');

        if (checkedRadio) {
          parentVal = checkedRadio.value;
        } else if (select) {
          parentVal = select.value;
        } else if (checkedBoxes.length > 0) {
          const vals = Array.from(checkedBoxes).map(cb => cb.value);
          if (vals.some(v => v.trim().toLowerCase() === expectedVal.trim().toLowerCase())) {
            parentVal = expectedVal;
          }
        }

        const shouldShow = (parentVal && parentVal.trim().toLowerCase() === expectedVal.trim().toLowerCase());

        if (shouldShow) {
          if (sub.style.display === 'none') {
            sub.style.display = 'block';
          }
        } else {
          if (sub.style.display !== 'none') {
            sub.style.display = 'none';
            clearSubSectionInputs(sub);
          }
        }
      });
    }

    function clearSubSectionInputs(sub) {
      sub.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(inp => {
        inp.value = '';
      });
      sub.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
        inp.checked = false;
      });
      sub.querySelectorAll('select').forEach(sel => {
        sel.value = '';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      sub.querySelectorAll('.card-error').forEach(card => card.classList.remove('card-error'));
    }

    document.querySelectorAll('input[type="radio"], select, input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', syncAllConditionalSubSections);
    });

    syncAllConditionalSubSections();
  }

  initConditionalSubSections();

  // Clear card error on any select change
  document.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      if (sel.value !== '') {
        const card = sel.closest('.card');
        if (card) card.classList.remove('card-error');
      }
    });
  });

  // Navigate to a specific step
  function goToStep(step) {
    // Hide all steps
    const steps = document.querySelectorAll('.form-step');
    steps.forEach(stepEl => stepEl.classList.remove('active'));

    const activeStepEl = document.getElementById(`step-${step}`);
    if (activeStepEl) {
      activeStepEl.classList.add('active');
    }
    currentStep = step;
    const progressPercent = (currentStep / totalSteps) * 100;
    progressBarFill.style.width = `${progressPercent}%`;
    
    const secName = activeStepEl ? activeStepEl.getAttribute('data-section-name') : null;
    progressText.textContent = secName ? secName : `Page ${currentStep} of ${totalSteps}`;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Helper to build preview/review summary of all answers dynamically
  function buildReviewSummary() {
    const container = document.getElementById('review-answers-container');
    if (!container) return;
    container.innerHTML = '';

    for (let stepNo = 1; stepNo <= totalSteps; stepNo++) {
      const stepEl = document.getElementById(`step-${stepNo}`);
      if (!stepEl) continue;

      const stepCards = stepEl.querySelectorAll('.card:not(.title-card):not(.progress-card)');
      if (stepCards.length === 0) continue;

      // Step header
      const stepHeader = document.createElement('div');
      stepHeader.className = 'summary-step-header';
      const secName = stepEl.getAttribute('data-section-name');
      stepHeader.textContent = secName ? secName : `Page ${stepNo} of ${totalSteps}`;
      container.appendChild(stepHeader);

      // Stacked container — full-width, one card below another
      const stepStack = document.createElement('div');
      stepStack.className = 'summary-step-cards';
      container.appendChild(stepStack);

      stepCards.forEach(card => {
        if (card.classList.contains('matrix-card')) {
          const matrixRows = card.querySelectorAll('.matrix-row');
          matrixRows.forEach(row => {
            const rowTitleEl = row.querySelector('.question-title');
            if (!rowTitleEl) return;
            let rowQuestionText = rowTitleEl.textContent.replace(/\s*\*\s*$/, '').trim();

            let rowAnswer = 'Not answered';
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            const checkedCbs = row.querySelectorAll('input[type="checkbox"]:checked');
            const sliderInput = row.querySelector('.slider-actual-input');

            if (checkedRadio) {
              rowAnswer = checkedRadio.value;
            } else if (checkedCbs.length > 0) {
              rowAnswer = Array.from(checkedCbs).map(cb => cb.value).join(', ');
            } else if (sliderInput && sliderInput.value) {
              rowAnswer = sliderInput.value;
            }
            const isNotAnswered = (rowAnswer === 'Not answered');

            const item = document.createElement('div');
            item.className = 'summary-item';

            const questionDiv = document.createElement('div');
            questionDiv.className = 'summary-question';
            questionDiv.textContent = rowQuestionText;

            const answerDiv = document.createElement('div');
            answerDiv.className = 'summary-answer' + (isNotAnswered ? ' not-answered' : '');
            answerDiv.textContent = rowAnswer;

            item.appendChild(questionDiv);
            item.appendChild(answerDiv);
            stepStack.appendChild(item);
          });
          return;
        }

        const titleEl = card.querySelector('.question-title');
        if (!titleEl) return;

        let questionText = titleEl.textContent.replace(/\s*\*\s*$/, '').trim();
        let answerText = '';

        const textInput = card.querySelector('input[type="text"]:not(.other-text-input), input[type="email"], textarea');
        const selectInput = card.querySelector('select');
        const checkboxes = card.querySelectorAll('input[type="checkbox"]');
        const radios = card.querySelectorAll('input[type="radio"]');

        if (textInput) {
          const val = textInput.value.trim();
          answerText = val || 'Not answered';
        } else if (selectInput) {
          if (selectInput.disabled) {
            answerText = 'Not applicable';
          } else {
            const val = selectInput.value;
            if (!val) {
              answerText = 'Not answered';
            } else if (val.toLowerCase().startsWith('other')) {
              const otherInput = card.querySelector('.other-text-input');
              const otherVal = otherInput ? otherInput.value.trim() : '';
              answerText = otherVal ? `Other: ${otherVal}` : 'Other';
            } else {
              answerText = val;
            }
          }
        } else if (checkboxes.length > 0) {
          const checked = Array.from(checkboxes).filter(cb => cb.checked);
          if (checked.length === 0) {
            answerText = 'Not answered';
          } else {
            const tags = [];
            checked.forEach(cb => {
              if (cb.value.toLowerCase().startsWith('other')) {
                const otherInput = card.querySelector('.other-text-input');
                const otherVal = otherInput ? otherInput.value.trim() : '';
                tags.push(otherVal ? `Other: ${otherVal}` : 'Other');
              } else {
                tags.push(cb.value);
              }
            });
            answerText = tags.join(', ');
          }
        } else if (radios.length > 0) {
          const checkedRadio = Array.from(radios).find(r => r.checked);
          if (checkedRadio) {
            answerText = checkedRadio.value;
          } else {
            answerText = 'Not answered';
          }
        }

        const isNotAnswered = (answerText === 'Not answered');

        const item = document.createElement('div');
        item.className = 'summary-item';

        const questionDiv = document.createElement('div');
        questionDiv.className = 'summary-question';
        questionDiv.textContent = questionText;

        const answerDiv = document.createElement('div');
        answerDiv.className = 'summary-answer' + (isNotAnswered ? ' not-answered' : '');
        answerDiv.textContent = answerText;

        item.appendChild(questionDiv);
        item.appendChild(answerDiv);
        stepStack.appendChild(item);
      });
    }
  }

  // Helper to escape HTML characters
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Helper to check if an element is currently visible (and not inside a hidden conditional sub-section)
  function isElementVisibleInDOM(el) {
    if (!el) return false;
    const conditionalSub = el.closest('.conditional-sub-section');
    if (conditionalSub && conditionalSub.style.display === 'none') {
      return false;
    }
    return true;
  }

  // Validate inputs within a specific step
  function validateStep(step) {
    const stepEl = document.getElementById(`step-${step}`);
    if (!stepEl) return true;

    let isValid = true;
    let firstInvalidCard = null;

    // Reset previous errors inside this step only
    const errorCards = stepEl.querySelectorAll('.card.card-error');
    errorCards.forEach(card => card.classList.remove('card-error'));

    // 1. Validate required text inputs, email inputs, and textareas (includes dynamic other inputs if required)
    const textInputs = stepEl.querySelectorAll('input[type="text"][required], input[type="email"][required], textarea[required]');
    textInputs.forEach(input => {
      if (!isElementVisibleInDOM(input)) return;
      const card = input.closest('.card');
      if (input.value.trim() === '') {
        isValid = false;
        card.classList.add('card-error');
        const errorMsg = card.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = 'This is a required question';
        if (!firstInvalidCard) firstInvalidCard = card;
      } else {
        const errorMsg = card.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = 'This is a required question';
      }
    });

    // 1b. Validate Email Format & Domain (for any input[type="email"], required or not, if it has a value)
    const emailInputs = stepEl.querySelectorAll('input[type="email"]');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ['vignan.ac.in', 'gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com'];
    
    emailInputs.forEach(input => {
      if (!isElementVisibleInDOM(input)) return;
      const card = input.closest('.card');
      const val = input.value.trim();
      if (val !== '') {
        if (val.length > 50) {
          isValid = false;
          card.classList.add('card-error');
          const errorMsg = card.querySelector('.error-message');
          if (errorMsg) errorMsg.textContent = 'Email ID cannot exceed 50 characters';
          if (!firstInvalidCard) firstInvalidCard = card;
        } else if (!emailRegex.test(val)) {
          isValid = false;
          card.classList.add('card-error');
          const errorMsg = card.querySelector('.error-message');
          if (errorMsg) errorMsg.textContent = 'Please enter a valid email address';
          if (!firstInvalidCard) firstInvalidCard = card;
        } else {
          const domain = val.split('@')[1].toLowerCase();
          if (!allowedDomains.includes(domain)) {
            isValid = false;
            card.classList.add('card-error');
            const errorMsg = card.querySelector('.error-message');
            if (errorMsg) errorMsg.textContent = 'Only ' + allowedDomains.join(', ') + ' emails are allowed';
            if (!firstInvalidCard) firstInvalidCard = card;
          }
        }
      }
    });

    // 1c. Validate exact lengths for Register No, Emp ID, and combined Register No / Emp ID
    const registerInputs = stepEl.querySelectorAll('.register-no-input');
    registerInputs.forEach(input => {
      if (!isElementVisibleInDOM(input)) return;
      const card = input.closest('.card');
      const val = input.value.trim();
      if (val !== '' && val.length !== 10) {
        isValid = false;
        card.classList.add('card-error');
        const errorMsg = card.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = 'Register No must be exactly 10 characters';
        if (!firstInvalidCard) firstInvalidCard = card;
      }
    });

    const employeeInputs = stepEl.querySelectorAll('.emp-id-input');
    employeeInputs.forEach(input => {
      if (!isElementVisibleInDOM(input)) return;
      const card = input.closest('.card');
      const val = input.value.trim();
      if (val !== '' && val.length !== 5) {
        isValid = false;
        card.classList.add('card-error');
        const errorMsg = card.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = 'Emp ID must be exactly 5 digits';
        if (!firstInvalidCard) firstInvalidCard = card;
      }
    });

    const regEmpInputsList = stepEl.querySelectorAll('.reg-emp-input');
    regEmpInputsList.forEach(input => {
      if (!isElementVisibleInDOM(input)) return;
      const card = input.closest('.card');
      const val = input.value.trim();
      if (val !== '') {
        const is5DigitEmp = (val.length === 5 && /^[0-9]{5}$/.test(val));
        const is10AlnumReg = (val.length === 10 && /^[a-zA-Z0-9]{10}$/.test(val));
        if (!is5DigitEmp && !is10AlnumReg) {
          isValid = false;
          card.classList.add('card-error');
          const errorMsg = card.querySelector('.error-message');
          if (errorMsg) errorMsg.textContent = 'Please enter a valid 10-character Register No or 5-digit Emp ID';
          if (!firstInvalidCard) firstInvalidCard = card;
        }
      }
    });

    // 2. Validate required select (dropdown) elements
    const selects = stepEl.querySelectorAll('select[required]');
    selects.forEach(select => {
      if (select.disabled || !isElementVisibleInDOM(select)) return; // Skip disabled / hidden dropdowns
      const card = select.closest('.card');
      if (select.value === '') {
        isValid = false;
        card.classList.add('card-error');
        if (!firstInvalidCard) firstInvalidCard = card;
      }
    });

    // 3. Validate Checkbox groups
    const requiredCheckboxCards = stepEl.querySelectorAll('.card[data-required-checkbox]');
    requiredCheckboxCards.forEach(card => {
      if (!isElementVisibleInDOM(card)) return;
      const checkedCheckboxes = card.querySelectorAll('input[type="checkbox"]:checked');
      if (checkedCheckboxes.length === 0) {
        isValid = false;
        card.classList.add('card-error');
        if (!firstInvalidCard) firstInvalidCard = card;
      } else {
        const otherCheckbox = card.querySelector('input[type="checkbox"][value="Other"]');
        if (otherCheckbox && otherCheckbox.checked) {
          const otherText = card.querySelector('.other-text-input');
          if (otherText && otherText.value.trim() === '') {
            isValid = false;
            card.classList.add('card-error');
            if (!firstInvalidCard) firstInvalidCard = card;
          }
        }
      }
    });

    // 4. Validate Rating (Radio) groups and normal Radio groups
    const requiredRadioCards = stepEl.querySelectorAll('.card[data-required-radio], .card[data-required-radio-option]');
    requiredRadioCards.forEach(card => {
      if (!isElementVisibleInDOM(card)) return;
      const checkedRadio = card.querySelector('input[type="radio"]:checked');
      if (!checkedRadio) {
        isValid = false;
        card.classList.add('card-error');
        if (!firstInvalidCard) firstInvalidCard = card;
      } else {
        const otherRadio = card.querySelector('input[type="radio"][value="Other"]');
        if (otherRadio && otherRadio.checked) {
          const otherText = card.querySelector('.other-text-input');
          if (otherText && otherText.value.trim() === '') {
            isValid = false;
            card.classList.add('card-error');
            if (!firstInvalidCard) firstInvalidCard = card;
          }
        }
      }
    });

    // 5. Validate Matrix (Radio, Checkbox, Slider) rows with Row-Level Precision
    const requiredMatrixRows = stepEl.querySelectorAll('.matrix-row[data-required-matrix-row], .matrix-row[data-required-matrix-checkbox], .matrix-row[data-required-matrix-slider]');
    requiredMatrixRows.forEach(row => {
      if (!isElementVisibleInDOM(row)) return;
      let isRowValid = false;
      if (row.hasAttribute('data-required-matrix-row')) {
        isRowValid = !!row.querySelector('input[type="radio"]:checked');
      } else if (row.hasAttribute('data-required-matrix-checkbox')) {
        isRowValid = row.querySelectorAll('input[type="checkbox"]:checked').length > 0;
      } else if (row.hasAttribute('data-required-matrix-slider')) {
        const sliderInput = row.querySelector('.slider-actual-input');
        const sliderCtrl = row.querySelector('.matrix-slider-control');
        isRowValid = (sliderCtrl && sliderCtrl.dataset.touched === '1' && sliderInput && sliderInput.value !== '');
      }

      if (!isRowValid) {
        isValid = false;
        row.classList.add('matrix-row-error');
        const matrixCard = row.closest('.card');
        if (matrixCard) matrixCard.classList.add('card-error');
        if (!firstInvalidCard) firstInvalidCard = row;
      } else {
        row.classList.remove('matrix-row-error');
      }
    });

    if (!isValid && firstInvalidCard) {
      firstInvalidCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
  }

  // Remove matrix-row-error and card-error immediately when a matrix radio or checkbox option is toggled
  document.addEventListener('change', (e) => {
    if (e.target && (e.target.matches('.matrix-row input[type="radio"]') || e.target.matches('.matrix-row input[type="checkbox"]'))) {
      const row = e.target.closest('.matrix-row');
      if (row) {
        let isNowValid = true;
        if (row.hasAttribute('data-required-matrix-checkbox')) {
          isNowValid = row.querySelectorAll('input[type="checkbox"]:checked').length > 0;
        }
        if (isNowValid) {
          row.classList.remove('matrix-row-error');
          const matrixCard = row.closest('.card');
          if (matrixCard && !matrixCard.querySelector('.matrix-row-error')) {
            matrixCard.classList.remove('card-error');
          }
        }
      }
    }
  });

  // Helper to reset all matrix sliders
  function resetAllSliders() {
    document.querySelectorAll('.matrix-slider-control').forEach(slider => {
      slider.dataset.touched = '0';
      slider.value = '0';
      slider.style.background = '#e2e8f0';
      slider.style.removeProperty('--slider-current-color');
      slider.style.removeProperty('--slider-glow-color');
      slider.style.removeProperty('--slider-percent');
      const row = slider.closest('.matrix-row');
      if (row) {
        const hiddenInput = row.querySelector('.slider-actual-input');
        if (hiddenInput) hiddenInput.value = '';
      }
    });
  }

  // Resolve continuous 0-100 range input to the appropriate option
  function resolveSliderOption(slider, rawVal) {
    const rawOptions = slider.getAttribute('data-options');
    let options = [];
    try {
      options = rawOptions ? JSON.parse(rawOptions) : [];
    } catch (e) {
      options = [];
    }
    const optCount = options.length;
    if (optCount === 0) return null;

    // Denominator for step targets: (2 * N - 1)
    const denom = 2 * optCount - 1;
    // Starting notch threshold (halfway between start 0 and option 1)
    const startThreshold = (0.5 / denom) * 100;

    if (rawVal < startThreshold) {
      return { index: 0, option: null, target: 0, isStart: true };
    }

    // Determine which option range the thumb falls in
    let chosenIdx = optCount;
    for (let k = 1; k <= optCount; k++) {
      const boundary = (2 * k / denom) * 100;
      if (rawVal < boundary) {
        chosenIdx = k;
        break;
      }
    }

    const opt = options[chosenIdx - 1];
    // Exact target percentage along the slider track (ends at 100% for the last option)
    const targetPercent = Math.round(((2 * chosenIdx - 1) / denom) * 1000) / 10;

    return { index: chosenIdx, option: opt, target: targetPercent, isStart: false };
  }

  // Update a single matrix slider's visual presentation
  function updateSliderVisual(slider) {
    const row = slider.closest('.matrix-row');
    if (!row) return;

    const rawVal = parseFloat(slider.value) || 0;
    const resolved = resolveSliderOption(slider, rawVal);
    if (!resolved) return;

    const hiddenInput = row.querySelector('.slider-actual-input');

    if (resolved.isStart) {
      // User dragged back to the initial start position
      slider.dataset.touched = '0';
      if (hiddenInput) hiddenInput.value = '';
      slider.value = 0;
      slider.style.background = '#e2e8f0';
      slider.style.removeProperty('--slider-current-color');
      slider.style.removeProperty('--slider-glow-color');
      slider.style.removeProperty('--slider-percent');
      return;
    }

    // An option was selected!
    slider.dataset.touched = '1';
    const opt = resolved.option;
    const targetPercent = resolved.target;

    // Direct snap to checkpoint: thumb goes straight to the option without double jumping
    slider.value = targetPercent;

    if (opt) {
      const label = opt.label || '';
      const color = opt.color || '#1a73e8';
      const glow = opt.glow || 'rgba(26, 115, 232, 0.25)';

      if (hiddenInput) hiddenInput.value = label;

      slider.style.setProperty('--slider-current-color', color);
      slider.style.setProperty('--slider-glow-color', glow);
      slider.style.setProperty('--slider-percent', `${targetPercent}%`);

      // Dynamic track fill: color only up to selected option's position with that option's color
      slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${targetPercent}%, #e2e8f0 ${targetPercent}%, #e2e8f0 100%)`;
    }

    row.classList.remove('matrix-row-error');
    const matrixCard = row.closest('.card');
    if (matrixCard && !matrixCard.querySelector('.matrix-row-error')) {
      matrixCard.classList.remove('card-error');
    }
  }

  // Pre-calculate target on pointerdown so click directly moves to the target checkpoint in 1 step
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.matches('.matrix-slider-control')) {
      const slider = e.target;
      const rect = slider.getBoundingClientRect();
      if (rect.width > 0) {
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
        slider.value = percent;
        updateSliderVisual(slider);
      }
    }
  });

  // Slider interactive input and change handlers
  document.addEventListener('input', (e) => {
    if (e.target && e.target.matches('.matrix-slider-control')) {
      updateSliderVisual(e.target);
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.matches('.matrix-slider-control')) {
      updateSliderVisual(e.target);
    }
  });

  // Helper to record client events in the session journey buffer
  function logClientEvent(actionMsg) {
    if (journeyTrail.length === 0 || journeyTrail[journeyTrail.length - 1] !== actionMsg) {
      journeyTrail.push(actionMsg);
    }
  }

  // Add navigation event listeners
  document.querySelectorAll('.next-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
          goToStep(currentStep + 1);
          logClientEvent('Moved to Step ' + currentStep);
        }
      } else {
        logClientEvent('Validation Failed (Step ' + currentStep + ')');
      }
    });
  });

  document.querySelectorAll('.prev-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
        logClientEvent('Back to Step ' + currentStep);
      }
    });
  });

  // Handle Clear Form (delegated/bound to button inside step-6)
  const clearBtn = document.getElementById('clear-form-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      const confirmModal = document.getElementById('confirm-modal');
      const confirmOkBtn = document.getElementById('confirm-ok-btn');
      const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

      if (confirmModal && confirmOkBtn && confirmCancelBtn) {
        confirmModal.style.display = 'flex';
        
        const newOkBtn = confirmOkBtn.cloneNode(true);
        const newCancelBtn = confirmCancelBtn.cloneNode(true);
        confirmOkBtn.parentNode.replaceChild(newOkBtn, confirmOkBtn);
        confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);

        newOkBtn.addEventListener('click', function() {
          confirmModal.style.display = 'none';
          form.reset();
          hideAllOtherContainers();
          resetAllSliders();
          resetHierarchicalDropdowns();
          const errorCards = document.querySelectorAll('.card.card-error');
          errorCards.forEach(card => card.classList.remove('card-error'));
          logClientEvent('Cleared Form');
          goToStep(1);
          hasVisitedSummary = false;
          if (returnToSummaryBtn) {
            returnToSummaryBtn.style.display = 'none';
          }
        });

        newCancelBtn.addEventListener('click', function() {
          confirmModal.style.display = 'none';
        });
      }
    });
  }

  // Close modal and reset form
  modalOkBtn.addEventListener('click', function () {
    successModal.style.display = 'none';

    // Hide summary, show form container, hide navigator & return btn
    const summarySection = document.getElementById('summary-section');
    const formContainer  = document.getElementById('form-container');
    const pageNavigator  = document.getElementById('page-navigator');
    if (summarySection) summarySection.style.display = 'none';
    if (formContainer)  formContainer.style.display  = 'block';
    if (pageNavigator)  pageNavigator.style.display  = 'none';
    // Full reset — hide return btn and clear visited flag
    if (returnToSummaryBtn) returnToSummaryBtn.style.display = 'none';
    hasVisitedSummary = false;

    form.reset();
    hideAllOtherContainers();
    resetAllSliders();
    resetHierarchicalDropdowns();
    logClientEvent('Reset Form');
    goToStep(1);
  });

  // Submit Form - show Response Summary before final submission
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    
    // Ensure all steps are valid before submission
    let isAllValid = true;
    for (let i = 1; i <= totalSteps; i++) {
      if (!validateStep(i)) {
        isAllValid = false;
        goToStep(i);
        break;
      }
    }

    if (isAllValid) {
      // Serialize form responses
      const formData = {};
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const name = input.name;
        if (!name) return;

        if (input.type === 'checkbox') {
          if (input.checked) {
            if (name.endsWith('[]')) {
              const baseName = name.slice(0, -2);
              if (!formData[baseName]) {
                formData[baseName] = [];
              }
              formData[baseName].push(input.value);
            } else {
              formData[name] = input.value;
            }
          }
        } else if (input.type === 'radio') {
          if (input.checked) {
            formData[name] = input.value;
          }
        } else {
          formData[name] = input.value;
        }
      });

      // Save feedback answers to sessionStorage
      sessionStorage.setItem('vignan_user_feedback', JSON.stringify(formData));
      logClientEvent('Viewed Summary');
      
      showSummary();
    }
  });

  // ── RESPONSE SUMMARY ─────────────────────────────────────────────────────
  // Reads all Q&A from the form DOM, builds grouped summary cards,
  // hides the form-container, and shows the summary-section in its place.
  // ─────────────────────────────────────────────────────────────────────────
  function showSummary() {
    const summarySection = document.getElementById('summary-section');
    const summaryBody    = document.getElementById('summary-body');
    const formContainer  = document.getElementById('form-container');
    if (!summarySection || !summaryBody) return;

    // Clear content from any previous run (user may Edit and re-submit)
    summaryBody.innerHTML = '';

    for (let stepNo = 1; stepNo <= totalSteps; stepNo++) {
      const stepEl = document.getElementById(`step-${stepNo}`);
      if (!stepEl) continue;

      const stepCards = stepEl.querySelectorAll('.card:not(.title-card):not(.progress-card)');
      if (stepCards.length === 0) continue;

      // ── Step group header ──────────────────────────────────────────────
      const stepHeader = document.createElement('div');
      stepHeader.className = 'summary-step-header';
      const secName = stepEl.getAttribute('data-section-name');
      stepHeader.textContent = secName ? secName : `Page ${stepNo} of ${totalSteps}`;
      summaryBody.appendChild(stepHeader);

      // Create stacked container — all cards full-width one below another
      const stepGrid = document.createElement('div');
      stepGrid.className = 'summary-step-cards';
      summaryBody.appendChild(stepGrid);

      stepCards.forEach(card => {
        if (card.classList.contains('matrix-card')) {
          const matrixRows = card.querySelectorAll('.matrix-row');
          matrixRows.forEach(row => {
            const rowTitleEl = row.querySelector('.question-title');
            if (!rowTitleEl) return;
            let rowQuestionText = '';
            rowTitleEl.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) rowQuestionText += node.textContent;
            });
            rowQuestionText = rowQuestionText.trim();
            if (!isElementVisibleInDOM(row)) {
              responseObj[rowQuestionText] = 'Not applicable';
              return;
            }
            let rowAnswer = 'Not answered';
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            const checkedCbs = row.querySelectorAll('input[type="checkbox"]:checked');
            const sliderInput = row.querySelector('.slider-actual-input');

            if (checkedRadio) {
              rowAnswer = checkedRadio.value;
            } else if (checkedCbs.length > 0) {
              rowAnswer = Array.from(checkedCbs).map(cb => cb.value).join(', ');
            } else if (sliderInput && sliderInput.value) {
              rowAnswer = sliderInput.value;
            }
            const isNotAnswered = (rowAnswer === 'Not answered');

            const item = document.createElement('div');
            item.className = 'summary-item';

            const questionDiv = document.createElement('div');
            questionDiv.className = 'summary-question';
            questionDiv.textContent = rowQuestionText;

            const answerDiv = document.createElement('div');
            answerDiv.className = 'summary-answer' + (isNotAnswered ? ' not-answered' : '');
            answerDiv.textContent = rowAnswer;

            item.appendChild(questionDiv);
            item.appendChild(answerDiv);
            stepGrid.appendChild(item);
          });
          return;
        }

        const questionTitleEl = card.querySelector('.question-title');
        if (!questionTitleEl || !isElementVisibleInDOM(card)) return; // skip non-question or hidden elements

        // ── Extract question text (strips the required asterisk span) ──
        let questionText = '';
        questionTitleEl.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            questionText += node.textContent;
          }
        });
        questionText = questionText.trim();

        // ── Extract user's answer based on input type ──────────────────
        let answerText    = '';
        let isNotAnswered = false;

        const textInput  = card.querySelector('input[type="text"]:not(.other-text-input), input[type="email"], textarea');
        const selectEl   = card.querySelector('select');
        const checkboxes = card.querySelectorAll('input[type="checkbox"]');

        if (textInput) {
          answerText = textInput.value.trim();
          if (!answerText) { answerText = 'Not answered'; isNotAnswered = true; }
        } else if (selectEl) {
          const selectedVal = selectEl.value;
          if (!selectedVal) {
            answerText = 'Not answered';
            isNotAnswered = true;
          } else if (selectedVal.toLowerCase().startsWith('other')) {
            const otherTargetId  = selectEl.getAttribute('data-other-target');
            const otherContainer = document.getElementById(otherTargetId);
            const otherInput     = otherContainer
              ? otherContainer.querySelector('.other-text-input')
              : null;
            const otherVal = otherInput ? otherInput.value.trim() : '';
            answerText = otherVal ? `Other: ${otherVal}` : 'Other';
          } else {
            answerText = selectedVal;
          }
        } else if (checkboxes.length > 0) {
          const checkedValues = [];
          checkboxes.forEach(cb => {
            if (cb.checked) {
              if (cb.value === 'Other') {
                const otherInput = card.querySelector('.other-text-input');
                const otherVal = otherInput ? otherInput.value.trim() : '';
                checkedValues.push(otherVal ? `Other: ${otherVal}` : 'Other');
              } else {
                checkedValues.push(cb.value);
              }
            }
          });
          if (checkedValues.length === 0) {
            answerText = 'Not answered';
            isNotAnswered = true;
          } else {
            answerText = checkedValues.join(', ');
          }
        } else {
          const radios = card.querySelectorAll('input[type="radio"]');
          if (radios.length > 0) {
            const checkedRadio = Array.from(radios).find(r => r.checked);
            if (checkedRadio) {
              if (checkedRadio.value.toLowerCase().startsWith('other')) {
                const otherInput = card.querySelector('.other-text-input');
                const otherVal = otherInput ? otherInput.value.trim() : '';
                answerText = otherVal ? `Other: ${otherVal}` : 'Other';
              } else {
                answerText = checkedRadio.value;
              }
            } else {
              answerText = 'Not answered';
              isNotAnswered = true;
            }
          }
        }

        // ── Build summary item card (question label + answer) ──────────
        const item = document.createElement('div');
        item.className = 'summary-item';

        const questionDiv = document.createElement('div');
        questionDiv.className = 'summary-question';
        questionDiv.textContent = questionText;

        const answerDiv = document.createElement('div');
        answerDiv.className = 'summary-answer' + (isNotAnswered ? ' not-answered' : '');
        answerDiv.textContent = answerText;

        item.appendChild(questionDiv);
        item.appendChild(answerDiv);
        stepGrid.appendChild(item);
      });
    }

    // Hide form, reveal summary, show page navigator, hide return btn
    hasVisitedSummary = true;
    if (formContainer) formContainer.style.display = 'none';
    summarySection.style.display = 'block';
    const pageNav = document.getElementById('page-navigator');
    if (pageNav) pageNav.style.display = 'flex';
    if (returnToSummaryBtn) returnToSummaryBtn.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Edit button: hide summary, restore form, show return btn ────────
  const summaryEditBtn = document.getElementById('summary-edit-btn');
  if (summaryEditBtn) {
    summaryEditBtn.addEventListener('click', function () {
      logClientEvent('Edit from Summary');
      document.getElementById('summary-section').style.display = 'none';
      const formContainer = document.getElementById('form-container');
      if (formContainer) formContainer.style.display = 'block';
      const pageNav = document.getElementById('page-navigator');
      if (pageNav) pageNav.style.display = 'none';
      // Show the return btn since user has already visited summary
      if (returnToSummaryBtn) returnToSummaryBtn.style.display = 'flex';
    });
  }

  // Helper to extract all responses as JSON for submission
  function getResponsesData() {
    let respondentId = null;
    let hasRegisterNo = false;
    const responseObj = {};

    for (let stepNo = 1; stepNo <= totalSteps; stepNo++) {
      const stepEl = document.getElementById(`step-${stepNo}`);
      if (!stepEl) continue;

      const stepCards = stepEl.querySelectorAll('.card');
      stepCards.forEach(card => {
        if (card.classList.contains('matrix-card')) {
          const matrixRows = card.querySelectorAll('.matrix-row');
          matrixRows.forEach(row => {
            const rowTitleEl = row.querySelector('.question-title');
            if (!rowTitleEl) return;
            let rowQuestionText = '';
            rowTitleEl.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) rowQuestionText += node.textContent;
            });
            rowQuestionText = rowQuestionText.trim();
            if (!isElementVisibleInDOM(row)) {
              responseObj[rowQuestionText] = 'Not applicable';
              return;
            }
            let rowAnswer = 'Not answered';
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            const checkedCbs = row.querySelectorAll('input[type="checkbox"]:checked');
            const sliderInput = row.querySelector('.slider-actual-input');

            if (checkedRadio) {
              rowAnswer = checkedRadio.value;
            } else if (checkedCbs.length > 0) {
              rowAnswer = Array.from(checkedCbs).map(cb => cb.value);
            } else if (sliderInput && sliderInput.value) {
              rowAnswer = sliderInput.value;
            }
            responseObj[rowQuestionText] = rowAnswer;
          });
          return;
        }

        const questionTitleEl = card.querySelector('.question-title');
        if (!questionTitleEl) return;

        let questionText = '';
        questionTitleEl.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) questionText += node.textContent;
        });
        questionText = questionText.trim();

        if (!isElementVisibleInDOM(card)) {
          responseObj[questionText] = 'Not applicable';
          return;
        }

        let answerText = '';
        const textInput  = card.querySelector('input[type="text"]:not(.other-text-input), input[type="email"], textarea');
        const selectEl   = card.querySelector('select');
        const checkboxes = card.querySelectorAll('input[type="checkbox"]');
        const radios     = card.querySelectorAll('input[type="radio"]');

        if (textInput) {
          answerText = textInput.value.trim();
        } else if (selectEl) {
          if (selectEl.disabled) {
            answerText = 'Not applicable';
          } else {
            const selectedVal = selectEl.value;
            if (selectedVal.toLowerCase().startsWith('other')) {
              const otherTargetId  = selectEl.getAttribute('data-other-target');
              const otherContainer = document.getElementById(otherTargetId);
              const otherInput     = otherContainer ? otherContainer.querySelector('.other-text-input') : null;
              const otherVal = otherInput ? otherInput.value.trim() : '';
              answerText = otherVal ? `Other: ${otherVal}` : 'Other';
            } else {
              answerText = selectedVal;
            }
          }
        } else if (checkboxes.length > 0) {
          const checkedValues = [];
          checkboxes.forEach(cb => {
            if (cb.checked) {
              if (cb.value === 'Other') {
                const otherInput = card.querySelector('.other-text-input');
                const otherVal = otherInput ? otherInput.value.trim() : '';
                checkedValues.push(otherVal ? `Other: ${otherVal}` : 'Other');
              } else {
                checkedValues.push(cb.value);
              }
            }
          });
          answerText = checkedValues.length > 0 ? checkedValues : 'Not answered';
        } else if (radios.length > 0) {
          const checkedRadio = Array.from(radios).find(r => r.checked);
          if (checkedRadio) {
            if (checkedRadio.value.toLowerCase().startsWith('other')) {
              const otherInput = card.querySelector('.other-text-input');
              const otherVal = otherInput ? otherInput.value.trim() : '';
              answerText = otherVal ? `Other: ${otherVal}` : 'Other';
            } else {
              answerText = checkedRadio.value;
            }
          }
        }

        if (!answerText) answerText = 'Not answered';
        responseObj[questionText] = answerText;

        // Try to identify respondent_id if the question asks for Register No or Emp ID or Email
        const qLower = questionText.toLowerCase();
        if (qLower.includes('register no') || qLower.includes('emp id')) {
          if (answerText !== 'Not answered') {
            respondentId = answerText;
            hasRegisterNo = true;
          }
        } else if (qLower.includes('email id') || qLower.includes('email')) {
          if (answerText !== 'Not answered' && !hasRegisterNo) {
            respondentId = answerText;
          }
        }
      });
    }

    return { respondentId, responseObj };
  }

  // ── Final Submit button: POST data, hide summary + return btn, show modal ──────
  const summarySubmitBtn = document.getElementById('summary-submit-btn');
  if (summarySubmitBtn) {
    // Helper function to show top error popup modal
    const showTopErrorPopup = (message) => {
      const modal = document.getElementById('top-error-modal');
      const descEl = document.getElementById('top-error-desc');
      if (descEl) {
        descEl.textContent = message || 'Please reload the page and try to fill the form again.';
      }
      if (modal) {
        modal.style.display = 'flex';
      }
    };

    document.getElementById('top-error-reload-btn')?.addEventListener('click', function () {
      window.location.reload();
    });

    document.getElementById('top-error-dismiss-btn')?.addEventListener('click', function () {
      const modal = document.getElementById('top-error-modal');
      if (modal) modal.style.display = 'none';
    });

    document.getElementById('top-error-close-x')?.addEventListener('click', function () {
      const modal = document.getElementById('top-error-modal');
      if (modal) modal.style.display = 'none';
    });

    document.getElementById('top-error-modal')?.addEventListener('click', function (e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });

    // Helper function to show inline errors on submit
    const showSubmitError = (message) => {
      let errBanner = document.getElementById('submit-inline-error');
      if (!errBanner) {
        errBanner = document.createElement('div');
        errBanner.id = 'submit-inline-error';
        errBanner.className = 'error-banner';
        errBanner.style.marginTop = '16px';
        summarySubmitBtn.parentNode.insertBefore(errBanner, summarySubmitBtn);
      }
      errBanner.innerHTML = `<div class="error-banner-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div><div class="error-banner-content"><span class="error-banner-text">${escapeHtml(message)}</span></div>`;
    };

    summarySubmitBtn.addEventListener('click', function () {
      // Remove any existing error banner
      const existingError = document.getElementById('submit-inline-error');
      if (existingError) existingError.remove();

      summarySubmitBtn.disabled = true;
      summarySubmitBtn.textContent = 'Submitting...';

      logClientEvent('Final Submit');
      const data = getResponsesData();
      const formEl = document.getElementById('feedback-form');
      const formId = formEl ? formEl.getAttribute('data-form-id') || 1 : 1;
      const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);

      fetch('../responses/submit_response.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: formId,
          respondent_id: data.respondentId,
          response: data.responseObj,
          journey: journeyTrail,
          duration_sec: durationSec
        })
      })
      .then(res => res.json())
      .then(resData => {
        summarySubmitBtn.disabled = false;
        summarySubmitBtn.textContent = 'Final Submit \u2192';

        if (resData.success) {
          isSessionSubmitted = true;
          document.getElementById('summary-section').style.display = 'none';
          const pageNav = document.getElementById('page-navigator');
          if (pageNav) pageNav.style.display = 'none';
          if (returnToSummaryBtn) returnToSummaryBtn.style.display = 'none';
          successModal.style.display = 'flex';
        } else {
          showTopErrorPopup('Please reload the page and try to fill the form again.');
          showSubmitError(resData.error || 'Error Submitting Form, Please reload and try to fill the form again.');
        }
      })
      .catch(err => {
        summarySubmitBtn.disabled = false;
        summarySubmitBtn.textContent = 'Final Submit \u2192';
        showTopErrorPopup('Please reload the page and try to fill the form again.');
        showSubmitError('Error Submitting Form, Please reload and try to fill the form again.');
      });
    });
  }

  // ── Return to Summary button: re-show summary from any form step ────
  if (returnToSummaryBtn) {
    returnToSummaryBtn.addEventListener('click', function () {
      logClientEvent('Return to Summary');
      showSummary();
    });
  }

  // ── Page Navigator: jump to a specific step from summary ──────────────
  const pageNavigatorEl = document.getElementById('page-navigator');
  const pageJumpInput   = document.getElementById('page-jump-input');
  const pageJumpBtn     = document.getElementById('page-jump-btn');
  const pageJumpHint    = document.getElementById('page-navigator-hint');

  function doPageJump() {
    const val = parseInt(pageJumpInput.value, 10);
    if (isNaN(val) || val < 1 || val > totalSteps) {
      pageJumpHint.textContent = `Enter 1–${totalSteps}`;
      pageJumpInput.focus();
      return;
    }
    pageJumpHint.textContent = '';
    // Hide summary, hide navigator, show form, go to step
    document.getElementById('summary-section').style.display = 'none';
    if (pageNavigatorEl) pageNavigatorEl.style.display = 'none';
    const formContainer = document.getElementById('form-container');
    if (formContainer) formContainer.style.display = 'block';
    // Show return btn — user came from summary so they'll want to go back
    if (returnToSummaryBtn) returnToSummaryBtn.style.display = 'flex';
    logClientEvent('Jumped to Step ' + val);
    goToStep(val);
    pageJumpInput.value = '';
  }

  if (pageJumpBtn) pageJumpBtn.addEventListener('click', doPageJump);
  if (pageJumpInput) {
    pageJumpInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doPageJump();
      // Clear error hint on new input
      if (pageJumpHint) pageJumpHint.textContent = '';
    });
  }

  goToStep(1);

  // ── Adjust fixed elements position so they don't overlap the footer ──
  const siteFooter = document.querySelector('.site-footer');
  function adjustFixedElements() {
    if (!siteFooter) return;
    const footerRect = siteFooter.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // If footer is visible in viewport
    if (footerRect.top < windowHeight) {
      const visibleFooterHeight = windowHeight - footerRect.top;
      const marginFromFooter = 40; // Minimum margin above the footer
      const newBottom = Math.max(28, marginFromFooter + visibleFooterHeight);
      if (returnToSummaryBtn) returnToSummaryBtn.style.bottom = `${newBottom}px`;
      if (pageNavigatorEl) pageNavigatorEl.style.bottom = `${newBottom}px`;
    } else {
      if (returnToSummaryBtn) returnToSummaryBtn.style.bottom = '28px';
      if (pageNavigatorEl) pageNavigatorEl.style.bottom = '28px';
    }
  }

  window.addEventListener('scroll', adjustFixedElements);
  window.addEventListener('resize', adjustFixedElements);
  
  // Use ResizeObserver to detect when form steps change height
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      // Small timeout to allow layout to settle
      setTimeout(adjustFixedElements, 10);
    });
    resizeObserver.observe(document.body);
  }

  // ── Session Abandonment Telemetry ──────────────────────────────────────────
  let abandonmentLogged = false;
  function flushAbandonment() {
    if (abandonmentLogged || isSessionSubmitted) return;
    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    // Ignore accidental immediate closes (< 3s with only 'Opened Form')
    if (durationSec < 3 && journeyTrail.length <= 1) return;
    abandonmentLogged = true;
    const formEl = document.getElementById('feedback-form');
    const formId = formEl ? formEl.getAttribute('data-form-id') || 1 : 1;
    const payload = JSON.stringify({
      event: 'Session Abandoned',
      form_id: formId,
      journey: journeyTrail,
      duration_sec: durationSec
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('log_event.php', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('log_event.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  }

  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && !isSessionSubmitted) {
      flushAbandonment();
    }
  });

  window.addEventListener('beforeunload', function () {
    if (!isSessionSubmitted) {
      flushAbandonment();
    }
  });

  // Initial check
  adjustFixedElements();
});
