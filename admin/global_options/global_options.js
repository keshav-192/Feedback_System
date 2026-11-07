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

  // Bucket Elements
  const parentGroupSelect = document.getElementById("opt-parent-group");
  const parentModeToggle = document.getElementById("parent-mode-toggle");
  const parentSearchWrapper = document.getElementById("parent-search-wrapper");
  const parentSelectWrapper = document.getElementById("parent-select-wrapper");
  const parentSearchInput = document.getElementById("parent-search-input");
  const parentSearchClear = document.getElementById("parent-search-clear");
  const parentSearchDropdown = document.getElementById("parent-search-dropdown");
  let currentParentMode = 'search'; // Default mode is search

  const flatChoicesContainer = document.getElementById("flat-choices-container");
  const bucketChoicesContainer = document.getElementById("bucket-choices-container");
  const bucketsList = document.getElementById("buckets-list");
  const addBucketBtn = document.getElementById("add-bucket-btn");
  
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
      
      const parentBadge = opt.parent_group ? `<span class="parent-group-pill">↳ Depends on: ${opt.parent_group}</span>` : '';

      card.innerHTML = `
        <div class="option-set-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="option-set-title">${opt.group_name}</div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px;">
              <span class="option-set-id">${opt.group_id}</span>
              ${parentBadge}
            </div>
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
      viewOptionsTitle.innerHTML = `${opt.group_name} <span class="option-set-id" style="font-size: 13px; font-weight: normal; margin-left: 8px;">${opt.group_id}</span>${opt.parent_group ? ` <span class="parent-group-pill" style="margin-left: 8px;">↳ Depends on: ${opt.parent_group}</span>` : ''}`;
      const lis = (opt.options || []).map(c => `
        <li class="option-choice-item" style="flex-direction: column; align-items: flex-start; gap: 6px;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <span style="font-weight: 500; color: #1e293b;">${c.label}</span>
            <span class="option-choice-weight">Weight: ${c.weight}</span>
          </div>
          ${c.parents && c.parents.length > 0 ? `
            <div class="choice-parents-tags">
              ${c.parents.map(p => `<span class="choice-parent-tag">${p}</span>`).join('')}
            </div>
          ` : ''}
        </li>
      `).join('');
      viewOptionsList.innerHTML = lis;
      viewModal.style.display = 'flex';
    }
  }

  function setParentMode(mode) {
    currentParentMode = mode;
    const btns = parentModeToggle ? parentModeToggle.querySelectorAll('.mode-toggle-btn') : [];
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    if (mode === 'search') {
      if (parentSearchWrapper) parentSearchWrapper.style.display = 'block';
      if (parentSelectWrapper) parentSelectWrapper.style.display = 'none';
      if (parentSearchInput && parentGroupSelect) {
        parentSearchInput.value = parentGroupSelect.value || '';
        if (parentSearchClear) {
          parentSearchClear.style.display = parentSearchInput.value ? 'block' : 'none';
        }
      }
    } else {
      if (parentSearchWrapper) parentSearchWrapper.style.display = 'none';
      if (parentSelectWrapper) parentSelectWrapper.style.display = 'block';
      if (parentSearchDropdown) parentSearchDropdown.classList.remove('show');
    }
  }

  parentModeToggle?.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setParentMode(btn.dataset.mode);
    });
  });

  function renderParentSearchDropdown(filterText = '') {
    if (!parentSearchDropdown) return;
    parentSearchDropdown.innerHTML = '';
    const filterLower = filterText.toLowerCase();

    // Option 1: None (Independent Option Set)
    const noneItem = document.createElement('div');
    const isNoneSelected = !parentGroupSelect || !parentGroupSelect.value;
    noneItem.className = 'parent-search-item item-none' + (isNoneSelected ? ' selected' : '');
    noneItem.innerHTML = `<span>None (Independent Option Set)</span>`;
    noneItem.addEventListener('click', () => {
      selectParentOption('');
    });
    parentSearchDropdown.appendChild(noneItem);

    // Eligible parent groups (exclude currently edited group ID)
    const eligible = globalOptions.filter(opt => opt.group_id !== currentEditGroupId && opt.group_name);
    const matches = filterLower 
      ? eligible.filter(opt => opt.group_name.toLowerCase().includes(filterLower) || (opt.group_id && opt.group_id.toLowerCase().includes(filterLower)))
      : eligible;

    if (matches.length === 0 && filterLower) {
      const emptyItem = document.createElement('div');
      emptyItem.style.padding = '12px 14px';
      emptyItem.style.textAlign = 'center';
      emptyItem.style.color = '#94a3b8';
      emptyItem.style.fontSize = '13px';
      emptyItem.textContent = `No option sets matching "${filterText}"`;
      parentSearchDropdown.appendChild(emptyItem);
    } else {
      matches.forEach(opt => {
        const isSel = parentGroupSelect && parentGroupSelect.value === opt.group_name;
        const item = document.createElement('div');
        item.className = 'parent-search-item' + (isSel ? ' selected' : '');
        item.innerHTML = `<span>${opt.group_name}</span><span class="item-id-badge">${opt.group_id}</span>`;
        item.addEventListener('click', () => {
          selectParentOption(opt.group_name);
        });
        parentSearchDropdown.appendChild(item);
      });
    }
  }

  function selectParentOption(groupName) {
    if (parentSearchInput) parentSearchInput.value = groupName;
    if (parentSearchClear) parentSearchClear.style.display = groupName ? 'block' : 'none';
    if (parentSearchDropdown) parentSearchDropdown.classList.remove('show');

    if (parentGroupSelect) {
      parentGroupSelect.value = groupName;
      parentGroupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  parentSearchInput?.addEventListener('focus', () => {
    renderParentSearchDropdown(parentSearchInput.value.trim());
    parentSearchDropdown?.classList.add('show');
  });

  parentSearchInput?.addEventListener('input', function() {
    const val = this.value.trim();
    renderParentSearchDropdown(val);
    parentSearchDropdown?.classList.add('show');
    if (parentSearchClear) parentSearchClear.style.display = val ? 'block' : 'none';

    // If cleared completely by typing/backspace, reset parent to None
    if (!val && parentGroupSelect && parentGroupSelect.value !== '') {
      parentGroupSelect.value = '';
      parentGroupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  parentSearchClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectParentOption('');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (parentSearchWrapper && !parentSearchWrapper.contains(e.target)) {
      parentSearchDropdown?.classList.remove('show');
      // If user typed something random that doesn't match, restore actual selected parent name
      if (parentSearchInput && parentGroupSelect) {
        parentSearchInput.value = parentGroupSelect.value || '';
        if (parentSearchClear) {
          parentSearchClear.style.display = parentSearchInput.value ? 'block' : 'none';
        }
      }
    }
  });

  // Keyboard navigation inside search input
  parentSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      parentSearchDropdown?.classList.remove('show');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const firstItem = parentSearchDropdown?.querySelector('.parent-search-item');
      if (firstItem) {
        firstItem.click();
      }
    }
  });

  function populateParentGroupDropdown(excludeGroupId = null) {
    if (!parentGroupSelect) return;
    const currentVal = parentGroupSelect.value;
    parentGroupSelect.innerHTML = '<option value="">None (Independent Option Set)</option>';
    globalOptions.forEach(opt => {
      if (opt.group_id !== excludeGroupId && opt.group_name) {
        const option = document.createElement('option');
        option.value = opt.group_name;
        option.textContent = `${opt.group_name} (${opt.group_id})`;
        parentGroupSelect.appendChild(option);
      }
    });
    if (currentVal) {
      parentGroupSelect.value = currentVal;
    }
    if (parentSearchInput) {
      parentSearchInput.value = parentGroupSelect.value || '';
      if (parentSearchClear) {
        parentSearchClear.style.display = parentSearchInput.value ? 'block' : 'none';
      }
    }
  }

  function addBucketCard(parentGroupName, selectedParents = [], choices = []) {
    if (!bucketsList) return;
    const parentSet = globalOptions.find(o => o.group_name === parentGroupName);
    const parentChoices = parentSet && parentSet.options ? parentSet.options.map(o => o.label) : [];

    const bucketIndex = bucketsList.querySelectorAll('.bucket-card').length + 1;
    const card = document.createElement('div');
    card.className = 'bucket-card';

    // Header with Bucket Title and Delete button
    const header = document.createElement('div');
    header.className = 'bucket-header';
    header.innerHTML = `
      <div class="bucket-badge">
        <span class="bucket-badge-icon">${bucketIndex}</span>
        <span>Bucket ${bucketIndex}</span>
      </div>
      <button type="button" class="btn-danger-outline btn-del-bucket" style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Remove Bucket">
        &times; Remove Bucket
      </button>
    `;
    card.appendChild(header);

    // Parents section (Pills grid with Select All / Clear All)
    const pillsSection = document.createElement('div');
    const pillsLabelRow = document.createElement('div');
    pillsLabelRow.style.display = 'flex';
    pillsLabelRow.style.justifyContent = 'space-between';
    pillsLabelRow.style.alignItems = 'center';
    pillsLabelRow.style.marginBottom = '6px';
    pillsLabelRow.innerHTML = `
      <span class="bucket-pills-label">Applicable ${parentGroupName}s (Click to toggle):</span>
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn-pill-select-all" style="background: none; border: none; color: #2563eb; font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 0;">Select All</button>
        <span style="color: #cbd5e1;">|</span>
        <button type="button" class="btn-pill-clear-all" style="background: none; border: none; color: #64748b; font-size: 11.5px; font-weight: 500; cursor: pointer; padding: 0;">Clear</button>
      </div>
    `;
    pillsSection.appendChild(pillsLabelRow);

    const pillsGrid = document.createElement('div');
    pillsGrid.className = 'bucket-pills-grid';

    parentChoices.forEach(pLabel => {
      const isSelected = selectedParents.includes(pLabel);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'bucket-program-pill' + (isSelected ? ' selected' : '');
      pill.dataset.parent = pLabel;
      pill.innerHTML = `<span>${isSelected ? '✓' : '+'}</span><span>${pLabel}</span>`;
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        const isSel = pill.classList.contains('selected');
        pill.querySelector('span:first-child').textContent = isSel ? '✓' : '+';
      });
      pillsGrid.appendChild(pill);
    });
    pillsSection.appendChild(pillsGrid);
    card.appendChild(pillsSection);

    // Select All / Clear All listeners
    pillsSection.querySelector('.btn-pill-select-all').addEventListener('click', () => {
      pillsGrid.querySelectorAll('.bucket-program-pill').forEach(pill => {
        pill.classList.add('selected');
        pill.querySelector('span:first-child').textContent = '✓';
      });
    });
    pillsSection.querySelector('.btn-pill-clear-all').addEventListener('click', () => {
      pillsGrid.querySelectorAll('.bucket-program-pill').forEach(pill => {
        pill.classList.remove('selected');
        pill.querySelector('span:first-child').textContent = '+';
      });
    });

    // Choices section
    const choicesBox = document.createElement('div');
    choicesBox.className = 'bucket-choices-box';
    choicesBox.innerHTML = `
      <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">Choices in this Bucket:</div>
      <div class="bucket-choices-list"></div>
      <button type="button" class="btn-secondary btn-add-bucket-choice" style="width: 100%; justify-content: center; font-size: 12.5px; padding: 6px 12px; margin-top: 4px;">
        + Add Choice to this Bucket
      </button>
    `;
    card.appendChild(choicesBox);

    const bChoicesList = choicesBox.querySelector('.bucket-choices-list');
    const addBChoiceBtn = choicesBox.querySelector('.btn-add-bucket-choice');

    function addRowToBucket(label = '', weight = '') {
      const row = document.createElement('div');
      row.className = 'choice-row';
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.marginBottom = '6px';
      row.innerHTML = `
        <input type="text" class="form-control opt-label-input" placeholder="Choice Label (e.g. Computer Science)" value="${label ? String(label).replace(/"/g, '&quot;') : ''}" style="flex: 1;">
        <input type="number" min="1" class="form-control opt-weight-input" placeholder="Weight" value="${weight !== '' ? weight : '1'}" style="width: 80px;">
        <button type="button" class="btn-danger-outline btn-del-choice-row" style="padding: 6px 10px; font-size: 14px;" title="Remove">&times;</button>
      `;
      row.querySelector('.btn-del-choice-row').addEventListener('click', () => row.remove());
      bChoicesList.appendChild(row);
    }

    if (choices && choices.length > 0) {
      choices.forEach(c => addRowToBucket(c.label, c.weight));
    } else {
      addRowToBucket();
    }

    addBChoiceBtn.addEventListener('click', () => addRowToBucket());

    // Remove Bucket listener
    header.querySelector('.btn-del-bucket').addEventListener('click', () => {
      card.remove();
      bucketsList.querySelectorAll('.bucket-card').forEach((bCard, idx) => {
        const num = idx + 1;
        const bBadge = bCard.querySelector('.bucket-badge');
        if (bBadge) {
          bBadge.innerHTML = `<span class="bucket-badge-icon">${num}</span><span>Bucket ${num}</span>`;
        }
      });
    });

    bucketsList.appendChild(card);
  }

  // Parent Group select change listener
  parentGroupSelect?.addEventListener('change', function() {
    const parentName = this.value;
    if (parentSearchInput && parentSearchInput.value !== parentName) {
      parentSearchInput.value = parentName || '';
      if (parentSearchClear) {
        parentSearchClear.style.display = parentName ? 'block' : 'none';
      }
    }
    if (!parentName) {
      if (flatChoicesContainer) flatChoicesContainer.style.display = 'block';
      if (bucketChoicesContainer) bucketChoicesContainer.style.display = 'none';
    } else {
      if (flatChoicesContainer) flatChoicesContainer.style.display = 'none';
      if (bucketChoicesContainer) bucketChoicesContainer.style.display = 'block';
      if (bucketsList && !bucketsList.querySelector('.bucket-card')) {
        const flatRows = Array.from(choicesList.querySelectorAll('.choice-row'));
        const migrated = [];
        flatRows.forEach(r => {
          const l = r.querySelector('.opt-label-input')?.value.trim();
          const w = r.querySelector('.opt-weight-input')?.value.trim();
          if (l) migrated.push({ label: l, weight: w || '1' });
        });
        addBucketCard(parentName, [], migrated);
      }
    }
  });

  addBucketBtn?.addEventListener('click', () => {
    const parentName = parentGroupSelect ? parentGroupSelect.value : '';
    if (!parentName) return;
    addBucketCard(parentName, [], []);
  });

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

    populateParentGroupDropdown();
    if (parentGroupSelect) parentGroupSelect.value = '';
    setParentMode('search'); // By default: Search mode
    if (parentSearchInput) parentSearchInput.value = '';
    if (parentSearchClear) parentSearchClear.style.display = 'none';
    if (parentSearchDropdown) parentSearchDropdown.classList.remove('show');

    if (flatChoicesContainer) flatChoicesContainer.style.display = 'block';
    if (bucketChoicesContainer) bucketChoicesContainer.style.display = 'none';
    if (bucketsList) bucketsList.innerHTML = '';

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

    populateParentGroupDropdown(opt.group_id);
    const parentGroup = opt.parent_group || '';
    if (parentGroupSelect) parentGroupSelect.value = parentGroup;
    setParentMode('search'); // By default: Search mode
    if (parentSearchInput) parentSearchInput.value = parentGroup;
    if (parentSearchClear) parentSearchClear.style.display = parentGroup ? 'block' : 'none';
    if (parentSearchDropdown) parentSearchDropdown.classList.remove('show');

    if (parentGroup) {
      if (flatChoicesContainer) flatChoicesContainer.style.display = 'none';
      if (bucketChoicesContainer) bucketChoicesContainer.style.display = 'block';
      if (bucketsList) bucketsList.innerHTML = '';

      const optsWithParents = (opt.options || []).filter(c => c.parents && c.parents.length > 0);
      if (optsWithParents.length > 0) {
        // Group choices by unique parents signature
        const bucketGroups = {};
        opt.options.forEach(c => {
          const key = c.parents && c.parents.length > 0 ? [...c.parents].sort().join('|||') : '__ALL__';
          if (!bucketGroups[key]) {
            bucketGroups[key] = { parents: c.parents || [], choices: [] };
          }
          bucketGroups[key].choices.push({ label: c.label, weight: c.weight });
        });
        Object.values(bucketGroups).forEach(bg => {
          addBucketCard(parentGroup, bg.parents, bg.choices);
        });
      } else {
        // Options exist, but no parents mapped yet (e.g. existing Department set)
        const allChoices = (opt.options || []).map(c => ({ label: c.label, weight: c.weight }));
        addBucketCard(parentGroup, [], allChoices);
      }
    } else {
      if (flatChoicesContainer) flatChoicesContainer.style.display = 'block';
      if (bucketChoicesContainer) bucketChoicesContainer.style.display = 'none';
      choicesList.innerHTML = '';
      if (opt.options && opt.options.length > 0) {
        opt.options.forEach(choice => addChoiceRow(choice.label, choice.weight, true));
      } else {
        addChoiceRow();
      }
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
    
    const parentGroupVal = parentGroupSelect ? parentGroupSelect.value.trim() : '';
    let choices = [];

    if (parentGroupVal) {
      // Collect choices from Buckets
      const bucketCards = Array.from(bucketsList.querySelectorAll('.bucket-card'));
      if (bucketCards.length === 0) {
        Swal.fire('No Buckets', 'Please add at least one bucket to define choices and their applicable programs.', 'warning');
        return;
      }

      const mergedChoicesMap = new Map();
      let validationError = null;

      bucketCards.forEach((bCard, bIdx) => {
        if (validationError) return;
        const selectedPills = Array.from(bCard.querySelectorAll('.bucket-program-pill.selected'));
        const selectedParentLabels = selectedPills.map(p => p.dataset.parent);
        if (selectedParentLabels.length === 0) {
          validationError = `Please select at least one applicable ${parentGroupVal} for Bucket ${bIdx + 1}.`;
          return;
        }

        const choiceRows = bCard.querySelectorAll('.choice-row');
        choiceRows.forEach(row => {
          const lInput = row.querySelector('.opt-label-input');
          const wInput = row.querySelector('.opt-weight-input');
          const lbl = lInput ? lInput.value.trim() : '';
          const wVal = wInput && wInput.value ? parseInt(wInput.value, 10) : 1;
          if (lbl) {
            const key = lbl.toLowerCase();
            if (!mergedChoicesMap.has(key)) {
              mergedChoicesMap.set(key, {
                label: lbl,
                weight: wVal >= 1 ? wVal : 1,
                parents: new Set(selectedParentLabels)
              });
            } else {
              const existing = mergedChoicesMap.get(key);
              selectedParentLabels.forEach(p => existing.parents.add(p));
            }
          }
        });
      });

      if (validationError) {
        Swal.fire('Missing Parent Selection', validationError, 'warning');
        return;
      }

      if (mergedChoicesMap.size === 0) {
        Swal.fire('Empty Choices', 'Please enter at least one choice inside the buckets.', 'warning');
        return;
      }

      choices = Array.from(mergedChoicesMap.values()).map(c => ({
        label: c.label,
        weight: c.weight,
        parents: Array.from(c.parents)
      }));
    } else {
      // Collect from Flat View
      const choiceRows = choicesList.querySelectorAll('.choice-row');
      
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
    }

    // Ensure 'Other:' is always at the end
    const otherIndex = choices.findIndex(c => c.label.toLowerCase() === 'other:');
    if (otherIndex !== -1 && otherIndex !== choices.length - 1) {
       const otherItem = choices.splice(otherIndex, 1)[0];
       choices.push(otherItem);
    }

    const payload = {
      group_name: nameInput,
      options: choices,
      parent_group: parentGroupVal
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
