// admin/global_options/global_options.js

document.addEventListener("DOMContentLoaded", function() {
  const gridContainer = document.getElementById("global-options-grid");
  const loadingState = document.getElementById("options-loading-state");
  const addOptionBtn = document.getElementById("add-global-option-btn");
  
  // Modal Elements
  const modal = document.getElementById("add-option-modal");
  const closeBtn = document.getElementById("close-option-modal-btn");
  const cancelBtn = document.getElementById("cancel-option-modal-btn");
  const saveBtn = document.getElementById("save-option-set-btn");
  const choicesList = document.getElementById("new-opt-choices-list");
  const addChoiceBtn = document.getElementById("add-choice-row-btn");
  const addOtherChoiceBtn = document.getElementById("add-other-choice-btn");
  
  const viewModal = document.getElementById("view-options-modal");
  const closeViewBtn = document.getElementById("close-view-options-btn");
  const viewOptionsTitle = document.getElementById("view-options-title");
  const viewOptionsList = document.getElementById("view-options-list");
  
  // Sort Controls
  const sortBtn = document.getElementById("sort-global-options-btn");
  const sortLabel = document.getElementById("sort-label");
  const sortIcon = document.getElementById("sort-icon");
  let currentSortOrder = 'oldest'; // 'oldest' | 'newest'

  function extractIdNumber(groupId) {
    if (!groupId) return 0;
    const m = String(groupId).match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  function getSortedOptions(list) {
    const sorted = [...list];
    sorted.sort((a, b) => {
      const numA = extractIdNumber(a.group_id) || (a._originalIndex !== undefined ? a._originalIndex + 1 : 0);
      const numB = extractIdNumber(b.group_id) || (b._originalIndex !== undefined ? b._originalIndex + 1 : 0);
      return currentSortOrder === 'newest' ? (numB - numA) : (numA - numB);
    });
    return sorted;
  }

  function updateSortButtonUI() {
    if (!sortBtn) return;
    if (currentSortOrder === 'newest') {
      sortBtn.classList.add('active-newest');
      if (sortLabel) sortLabel.innerHTML = 'Sort: <strong>Newest First</strong>';
      if (sortIcon) {
        sortIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"></path>`;
      }
    } else {
      sortBtn.classList.remove('active-newest');
      if (sortLabel) sortLabel.innerHTML = 'Sort: <strong>Oldest First</strong>';
      if (sortIcon) {
        sortIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>`;
      }
    }
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      currentSortOrder = currentSortOrder === 'oldest' ? 'newest' : 'oldest';
      updateSortButtonUI();
      populateSelectDropdown();
      const activeFilter = globalSelect ? globalSelect.value : 'all';
      renderGrid(activeFilter);
    });
  }
  
  // State
  let globalOptions = [];
  let currentEditGroupId = null;
  let currentEditGroupName = "";
  
  
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

  const filterInput = document.getElementById("global-options-filter");
  const filterDropdown = document.getElementById("global-options-dropdown");
  const filterWrapper = document.getElementById("global-options-search-wrapper");
  const globalPreviewBox = document.getElementById("global-preview-box");
  let previewTimeout;

  // Load options
  function loadGlobalOptions() {
    gridContainer.style.display = 'none';
    loadingState.style.display = 'block';
    
    // Add cache-buster to always get fresh options
    fetch(`../options.json?v=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        globalOptions = data.map((opt, idx) => ({ ...opt, _originalIndex: idx }));
        updateSortButtonUI();
        populateSelectDropdown();
        renderGrid('all');
        window.dispatchEvent(new Event('optionsUpdated'));
      })
      .catch(err => {
        console.error("Error loading options:", err);
        loadingState.innerHTML = '<span style="color: var(--error-color);">Failed to load options.</span>';
      });
  }

  const globalSelect = document.getElementById("global-options-select");

  function populateSelectDropdown() {
    if (!globalSelect) return;
    const currentVal = globalSelect.value;
    globalSelect.innerHTML = '<option value="all">All Option Sets</option>';
    const sortedOptions = getSortedOptions(globalOptions);
    sortedOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.group_id;
      option.textContent = opt.group_name;
      globalSelect.appendChild(option);
    });
    // Restore previous selection if it still exists
    if (Array.from(globalSelect.options).some(o => o.value === currentVal)) {
      globalSelect.value = currentVal;
    }
  }

  if (globalSelect) {
    globalSelect.addEventListener('change', (e) => {
      if(filterInput) filterInput.value = ''; // clear text search when using dropdown
      renderGrid(e.target.value);
    });
  }

  if (filterInput) {
    filterInput.addEventListener('input', function() {
      const val = this.value.toLowerCase();
      filterDropdown.innerHTML = '';
      
      let matches = globalOptions;
      if (val) {
          matches = matches.filter(opt => opt.group_name.toLowerCase().includes(val));
      } else {
          if(globalSelect) globalSelect.value = 'all'; // sync select when cleared
          renderGrid('all'); // if cleared, show all
      }
      matches = getSortedOptions(matches);
      
      if (matches.length > 0 && val) {
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
                 
                 const dropdownRect = filterDropdown.getBoundingClientRect();
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
            filterInput.value = match.group_name;
            filterDropdown.classList.remove('show');
            globalPreviewBox.style.display = 'none';
            if(globalSelect) globalSelect.value = match.group_id; // sync select
            renderGrid(match.group_id);
          });
          filterDropdown.appendChild(item);
        });
        filterDropdown.classList.add('show');
      } else {
        filterDropdown.classList.remove('show');
      }
    });

    filterInput.addEventListener('focus', function() {
      if (this.value) {
        this.dispatchEvent(new Event('input'));
      }
    });

    document.addEventListener('click', (e) => {
      if (filterWrapper && !filterWrapper.contains(e.target)) {
        filterDropdown.classList.remove('show');
      }
    });
  }

  function renderGrid(filterId = 'all') {
    loadingState.style.display = 'none';
    gridContainer.innerHTML = '';
    
    let optionsToRender = globalOptions;
    if (filterId !== 'all') {
      optionsToRender = globalOptions.filter(opt => opt.group_id === filterId);
    }
    optionsToRender = getSortedOptions(optionsToRender);
    
    optionsToRender.forEach(opt => {
      const card = document.createElement('div');
      card.className = 'option-set-card';
      
      let choicesHtml = '';
      if (opt.options && opt.options.length > 0) {
        if (opt.options.length > 5) {
          const visibleOpts = opt.options.slice(0, 5);
          
          const visibleLis = visibleOpts.map(c => `
            <li class="option-choice-item">
              <span>${c.label}</span>
              <span class="option-choice-weight">Weight: ${c.weight}</span>
            </li>
          `).join('');
          
          choicesHtml = `
            <ul class="option-choices-list" style="margin-bottom: 8px;">
              ${visibleLis}
            </ul>
            <button class="open-view-options-btn" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 13px; font-weight: 500; text-align: left; padding: 0;">Show All (${opt.options.length})</button>
          `;
        } else {
          const lis = opt.options.map(c => `
            <li class="option-choice-item">
              <span>${c.label}</span>
              <span class="option-choice-weight">Weight: ${c.weight}</span>
            </li>
          `).join('');
          choicesHtml = `<ul class="option-choices-list">${lis}</ul>`;
        }
      } else if (opt.type === 'TEXTAREA') {
        choicesHtml = `
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; color: var(--text-secondary); font-size: 13px;">
            Free Text Response (Textarea)
          </div>
        `;
      }
      
      card.innerHTML = `
        <div class="option-set-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="option-set-title">${opt.group_name}</div>
            <span class="option-set-id">${opt.group_id}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="btn-edit-option-set" data-group-id="${opt.group_id}" style="background: none; border: none; color: var(--primary-color); cursor: pointer; padding: 4px;" title="Edit Option Set">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </button>
            <button class="btn-delete-option-set" data-group-id="${opt.group_id}" style="background: none; border: none; color: var(--error-color); cursor: pointer; padding: 4px;" title="Delete Option Set">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>
        ${choicesHtml}
      `;
      
      gridContainer.appendChild(card);
      
      const viewBtn = card.querySelector('.open-view-options-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          openViewOptionsModal(opt);
        });
      }
      
      const editBtn = card.querySelector('.btn-edit-option-set');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          openEditModal(opt);
        });
      }

      const deleteBtn = card.querySelector('.btn-delete-option-set');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          const groupId = deleteBtn.getAttribute('data-group-id');
          Swal.fire({
            title: 'Are you sure?',
            html: `Delete "<strong>${opt.group_name}</strong>"? This action cannot be undone.<br><br><span style="color: #d33; font-weight: bold;">Warning: Deleting this will break analytics scoring for any existing forms that use this option set.</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
          }).then((result) => {
            if (result.isConfirmed) {
              fetch('global_options/delete_options.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_id: groupId })
              })
              .then(res => res.json())
              .then(data => {
                if(data.success) {
                  Swal.fire('Deleted!', 'The option set has been deleted.', 'success');
                  loadGlobalOptions(); // refresh grid
                } else {
                  if (data.in_use) {
                    Swal.fire({
                      title: 'Option Set is in Use!',
                      text: data.message,
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonColor: '#d33',
                      cancelButtonColor: '#3085d6',
                      confirmButtonText: 'Force Delete Anyway'
                    }).then((result2) => {
                      if (result2.isConfirmed) {
                        fetch('global_options/delete_options.php?force=1', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ group_id: groupId })
                        })
                        .then(res => res.json())
                        .then(data2 => {
                          if (data2.success) {
                            Swal.fire('Deleted!', 'The option set has been force deleted.', 'success');
                            loadGlobalOptions();
                          } else {
                            Swal.fire('Error', data2.message || 'Failed to delete.', 'error');
                          }
                        });
                      }
                    });
                  } else {
                    Swal.fire('Error', data.message || 'Failed to delete.', 'error');
                  }
                }
              })
              .catch(err => {
                console.error(err);
                Swal.fire('Error', 'Network error occurred.', 'error');
              });
            }
          });
        });
      }
    });
    
    gridContainer.style.display = 'grid';
  }

  // --- Modal Logic ---

  function openViewOptionsModal(opt) {
    if (viewOptionsTitle && viewOptionsList && viewModal) {
      viewOptionsTitle.textContent = opt.group_name;
      const lis = opt.options.map(c => `
        <li class="option-choice-item">
          <span>${c.label}</span>
          <span class="option-choice-weight">Weight: ${c.weight}</span>
        </li>
      `).join('');
      viewOptionsList.innerHTML = lis;
      viewModal.style.display = 'flex';
    }
  }

  closeViewBtn?.addEventListener('click', () => {
    viewModal.style.display = 'none';
  });

  function openModal() {
    currentEditGroupId = null;
    currentEditGroupName = "";
    document.querySelector('#add-option-modal h3').textContent = 'Add New Option Set';
    saveBtn.textContent = 'Save Option Set';
    const nameInput = document.getElementById('new-opt-name');
    nameInput.value = '';
    nameInput.readOnly = false;
    nameInput.style.backgroundColor = '';
    nameInput.title = '';
    choicesList.innerHTML = '';
    // Add two default rows
    addChoiceRow();
    addChoiceRow();
    updateOtherButtonState();
    modal.style.display = 'flex';
  }

  function openEditModal(opt) {
    currentEditGroupId = opt.group_id;
    currentEditGroupName = opt.group_name;
    document.querySelector('#add-option-modal h3').textContent = 'Edit Option Set';
    saveBtn.textContent = 'Update Option Set';
    const nameInput = document.getElementById('new-opt-name');
    nameInput.value = opt.group_name;
    nameInput.readOnly = true;
    nameInput.style.backgroundColor = '#f1f5f9';
    nameInput.title = 'Option Set Name cannot be changed to preserve analytics of existing forms.';
    choicesList.innerHTML = '';
    
    if (opt.options && opt.options.length > 0) {
      // Pass isExisting = true for options already saved
      opt.options.forEach(choice => addChoiceRow(choice.label, choice.weight, true));
    } else {
      addChoiceRow();
    }
    
    updateOtherButtonState();
    modal.style.display = 'flex';
  }

  function cancelModal() {
    modal.style.display = 'none';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  function addChoiceRow(label = '', weight = '', isExisting = false) {
    const row = document.createElement('div');
    row.className = 'choice-row';
    
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'form-control opt-label-input';
    labelInput.placeholder = 'Choice Label (e.g. Excellent)';
    labelInput.value = label;

    if (label.toLowerCase() === 'other:' || label.toLowerCase() === 'other') {
       labelInput.value = 'Other:';
       labelInput.readOnly = true;
       labelInput.style.backgroundColor = '#f1f5f9';
       labelInput.style.color = 'var(--text-secondary)';
       labelInput.title = 'Fixed term for standardizing "Other" responses';
    } else if (isExisting) {
       labelInput.readOnly = true;
       labelInput.style.backgroundColor = '#f1f5f9';
       labelInput.title = 'Existing options cannot be modified to preserve analytics data.';
    }
    
    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.min = '1';
    weightInput.className = 'form-control weight-input opt-weight-input';
    weightInput.placeholder = 'Weight';
    weightInput.value = weight !== '' ? weight : '1';
    
    if (isExisting) {
        weightInput.readOnly = true;
        weightInput.style.backgroundColor = '#f1f5f9';
        weightInput.title = 'Existing option weights cannot be modified.';
    }

    row.appendChild(labelInput);
    row.appendChild(weightInput);

    if (!isExisting) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger-outline';
        delBtn.innerHTML = '&times;';
        delBtn.style.padding = '8px 12px';
        delBtn.title = 'Remove Choice';
        delBtn.onclick = () => {
          row.remove();
          updateOtherButtonState();
        };
        row.appendChild(delBtn);
    } else {
        // Add a placeholder to keep layout consistent
        const placeholder = document.createElement('div');
        placeholder.style.width = '38px';
        row.appendChild(placeholder);
    }
    
    choicesList.appendChild(row);
    updateOtherButtonState();
  }

  function updateOtherButtonState() {
    if (!addOtherChoiceBtn) return;
    const labels = Array.from(choicesList.querySelectorAll('.opt-label-input')).map(input => input.value.trim().toLowerCase());
    const hasOther = labels.includes('other:');
    
    if (hasOther) {
       addOtherChoiceBtn.disabled = true;
       addOtherChoiceBtn.style.opacity = '0.5';
       addOtherChoiceBtn.style.cursor = 'not-allowed';
       addOtherChoiceBtn.title = "Only one 'Other' option is allowed per option set";
    } else {
       addOtherChoiceBtn.disabled = false;
       addOtherChoiceBtn.style.opacity = '1';
       addOtherChoiceBtn.style.cursor = 'pointer';
       addOtherChoiceBtn.title = "";
    }
  }

  addOptionBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', cancelModal);
  cancelBtn?.addEventListener('click', cancelModal);
  addChoiceBtn?.addEventListener('click', () => addChoiceRow());
  addOtherChoiceBtn?.addEventListener('click', () => addChoiceRow('Other:', '0'));

  // Real-time validation for Option Set Name
  const nameInputEl = document.getElementById('new-opt-name');
  if (nameInputEl) {
      nameInputEl.addEventListener('blur', function() {
          if (!currentEditGroupId) {
              const val = this.value.trim();
              if (val) {
                  const exists = globalOptions.some(opt => opt.group_name.toLowerCase() === val.toLowerCase());
                  if (exists) {
                      showInlineError(this, "An Option Set with this name already exists.");
                      if (saveBtn) saveBtn.disabled = true;
                  }
              }
          }
      });
      nameInputEl.addEventListener('input', function() {
          if (!currentEditGroupId) {
              const existing = this.parentNode.querySelector('.inline-error-text');
              if (existing) existing.remove();
              if (saveBtn) saveBtn.disabled = false;
          }
      });
  }

  // Save Option Set
  saveBtn?.addEventListener('click', () => {
    const nameInputEl = document.getElementById('new-opt-name');
    const nameInput = nameInputEl.value.trim();
    if (!nameInput) {
      showInlineError(nameInputEl, "Please enter a name for the Option Set.");
      return;
    }
    
    // Frontend duplicate name check for new option sets
    if (!currentEditGroupId) {
       const exists = globalOptions.some(opt => opt.group_name.toLowerCase() === nameInput.toLowerCase());
       if (exists) {
          showInlineError(nameInputEl, "An Option Set with this name already exists.");
          return;
       }
    }
    
    const choiceRows = choicesList.querySelectorAll('.choice-row');
    const choices = [];
    
    choiceRows.forEach(row => {
      const labelInput = row.querySelector('.opt-label-input');
      const weightInput = row.querySelector('.opt-weight-input');
      const label = labelInput.value.trim();
      let weightStr = weightInput.value.trim();
      
      if (label) {
        let weightVal = weightStr ? parseInt(weightStr, 10) : 1;
        if (weightVal < 1) {
            weightVal = 1;
        }
        
        choices.push({
          label: label,
          weight: weightVal
        });
      }
    });

    // Check for duplicate choices within this option set
    const labelCounts = {};
    let hasDuplicate = false;
    for (let c of choices) {
        const lowerLabel = c.label.toLowerCase();
        if (labelCounts[lowerLabel]) {
            hasDuplicate = true;
            break;
        }
        labelCounts[lowerLabel] = true;
    }

    if (hasDuplicate) {
        Swal.fire('Duplicate Choices', 'You have entered identical choices in this Option Set. Please ensure all choices are unique before saving.', 'warning');
        return;
    }

    // Ensure 'Other:' is always at the end
    const otherIndex = choices.findIndex(c => c.label.toLowerCase() === 'other:');
    if (otherIndex !== -1 && otherIndex !== choices.length - 1) {
       const otherItem = choices.splice(otherIndex, 1)[0];
       choices.push(otherItem);
    }

    const payload = {
      group_name: nameInput,
      options: choices
    };
    
    if (currentEditGroupId) {
      payload.group_id = currentEditGroupId;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    fetch('global_options/save_options.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      saveBtn.disabled = false;
      saveBtn.textContent = currentEditGroupId ? 'Update Option Set' : 'Save Option Set';
      
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Saved!',
          text: currentEditGroupId ? 'Option set updated successfully.' : 'New option set added successfully.',
          timer: 2000,
          showConfirmButton: false
        });
        closeModal();
        loadGlobalOptions(); // Refresh grid
      } else {
        Swal.fire('Error', data.message || 'Failed to save option set.', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      saveBtn.disabled = false;
      saveBtn.textContent = currentEditGroupId ? 'Update Option Set' : 'Save Option Set';
      Swal.fire('Error', 'Network error occurred.', 'error');
    });
  });

  // Load when the tab is activated
  const navItem = document.querySelector('a[data-target="global-options-section"]');
  if (navItem) {
    navItem.addEventListener('click', () => {
      // Only load if it's the first time or we want to refresh
      loadGlobalOptions();
    });
  }
  
  // Initial check
  if (document.getElementById('global-options-section')?.classList.contains('active')) {
    loadGlobalOptions();
  }
});
