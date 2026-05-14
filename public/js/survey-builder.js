// =============================================
// Survey Builder — Client-Side Logic
// =============================================

let questionCount = 0;

const questionTypeLabels = {
    mcq: 'Multiple Choice',
    short: 'Short Answer',
    long: 'Long Answer',
    checkbox: 'Checkbox',
    rating: 'Rating Scale',
    dropdown: 'Dropdown',
    yesno: 'Yes/No',
    datetime: 'Date/Time'
};

const questionTypeIcons = {
    mcq: 'bi-ui-radios',
    short: 'bi-input-cursor-text',
    long: 'bi-textarea-resize',
    checkbox: 'bi-check2-square',
    rating: 'bi-star-fill',
    dropdown: 'bi-menu-button-wide',
    yesno: 'bi-toggle-on',
    datetime: 'bi-calendar-time'
};

// ── Client-side meaningful-text validator ─────────────────────────────────
function validateMeaningfulText(text, fieldName, minLen) {
    minLen = minLen || 3;
    const t = (text || '').trim();
    if (!t) return fieldName + ' is required.';
    if (t.length < minLen) return fieldName + ' must be at least ' + minLen + ' characters.';

    // Repeated single character
    if (/^(.)\1+$/.test(t))
        return fieldName + ' contains repeated characters. Please enter meaningful text.';

    const lower = t.toLowerCase().replace(/\s/g, '');

    // Low vowel ratio (gibberish like "bvcxzlkj")
    const vowels = ['a','e','i','o','u'];
    const letters = lower.replace(/[^a-z]/g, '');
    if (letters.length >= 6) {
        let vowelCount = 0;
        for (let i = 0; i < letters.length; i++) {
            if (vowels.indexOf(letters[i]) !== -1) vowelCount++;
        }
        if (vowelCount / letters.length < 0.1)
            return fieldName + " doesn't appear to contain real words. Please use meaningful text.";
    }

    // Pure numbers / symbols
    if (/^[\d\s\W]+$/.test(t))
        return fieldName + ' must contain real words, not just numbers or symbols.';

    return null;
}

function showFieldError(el, msg) {
    clearFieldError(el);
    el.style.borderColor = '#ef4444';
    const err = document.createElement('div');
    err.className = 'survey-validation-error';
    err.style.cssText = 'color:#ef4444;font-size:0.8rem;margin-top:4px;font-weight:500;';
    err.textContent = '⚠ ' + msg;
    el.parentNode.insertBefore(err, el.nextSibling);
}

function clearFieldError(el) {
    el.style.borderColor = '';
    const next = el.nextSibling;
    if (next && next.classList && next.classList.contains('survey-validation-error')) {
        next.remove();
    }
}

// Initialize with existing questions (if editing)
document.addEventListener('DOMContentLoaded', function () {
    if (typeof existingQuestions !== 'undefined' && existingQuestions.length > 0) {
        existingQuestions.forEach(function (q) {
            addQuestion(q.question_type, q.question_text, q.options, q.is_required);
        });
    }
    updateEmptyMessage();
    updateAddQuestionButtonsVisibility();

    // ── Form submit validation ──
    const form = document.getElementById('surveyForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            let hasError = false;

            // Title
            const titleEl = document.getElementById('title');
            const titleErr = validateMeaningfulText(titleEl.value, 'Survey Title', 5);
            if (titleErr) { showFieldError(titleEl, titleErr); hasError = true; }
            else clearFieldError(titleEl);

            // Description (optional but validated if filled)
            const descEl = document.getElementById('description');
            if (descEl && descEl.value.trim().length > 0) {
                const descErr = validateMeaningfulText(descEl.value, 'Description', 10);
                if (descErr) { showFieldError(descEl, descErr); hasError = true; }
                else clearFieldError(descEl);
            } else if (descEl) {
                clearFieldError(descEl);
            }

            // All question text inputs
            const qInputs = form.querySelectorAll('input[name$="[text]"]');
            qInputs.forEach(function (input, idx) {
                if (!input.value.trim()) return;
                const qErr = validateMeaningfulText(input.value, 'Question ' + (idx + 1), 5);
                if (qErr) { showFieldError(input, qErr); hasError = true; }
                else clearFieldError(input);
            });

            if (hasError) {
                e.preventDefault();
                const firstErr = form.querySelector('.survey-validation-error');
                if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
});

function addQuestion(type, text, options, required) {
    text = text || '';
    options = options || null;
    required = required || false;

    const container = document.getElementById('questionsContainer');
    const index = questionCount++;

    const block = document.createElement('div');
    block.className = 'question-block';
    block.id = 'question-' + index;
    block.dataset.index = index;

    let optionsHTML = '';
    if (type === 'mcq' || type === 'checkbox' || type === 'dropdown') {
        const opts = options && options.length > 0 ? options : ['', ''];
        optionsHTML = '<div class="options-container" id="options-' + index + '">' +
            '<label class="form-label" style="font-size:0.85rem;color:var(--text-secondary);">Options</label>' +
            opts.map(function (opt, i) {
                return '<div class="option-row" id="option-' + index + '-' + i + '">' +
                    '<span class="text-muted" style="font-size:0.8rem;min-width:20px;">' + (i + 1) + '.</span>' +
                    '<input type="text" class="form-control form-control-sm" name="questions[' + index + '][options][]" value="' + escapeHtml(opt) + '" placeholder="Option ' + (i + 1) + '">' +
                    '<button type="button" class="remove-option-btn" onclick="removeOption(' + index + ', ' + i + ')" title="Remove"><i class="bi bi-x-circle"></i></button>' +
                    '</div>';
            }).join('') +
            '<button type="button" class="add-option-btn mt-2" onclick="addOption(' + index + ')"><i class="bi bi-plus me-1"></i>Add Option</button>' +
            '</div>';
    }

    block.innerHTML =
        '<div class="question-block-header">' +
            '<div class="d-flex align-items-center gap-2">' +
                '<span class="question-type-badge"><i class="bi ' + questionTypeIcons[type] + ' me-1"></i>' + questionTypeLabels[type] + '</span>' +
            '</div>' +
            '<button type="button" class="remove-question-btn" onclick="removeQuestion(' + index + ')" title="Remove Question"><i class="bi bi-trash me-1"></i>Remove</button>' +
        '</div>' +
        '<input type="hidden" name="questions[' + index + '][type]" value="' + type + '">' +
        '<div class="form-floating-custom mb-3">' +
            '<label>Question Text <span class="text-danger">*</span></label>' +
            '<input type="text" class="form-control" name="questions[' + index + '][text]" value="' + escapeHtml(text) + '" placeholder="Enter your question" required>' +
        '</div>' +
        optionsHTML +
        '<div class="d-flex justify-content-between align-items-center mt-3">' +
            '<div class="form-check">' +
                '<input class="form-check-input" type="checkbox" name="questions[' + index + '][required]" id="req-' + index + '" value="true" ' + (required ? 'checked' : '') + '>' +
                '<label class="form-check-label" for="req-' + index + '" style="font-size:0.85rem;">Required</label>' +
            '</div>' +
            '<div class="dropup add-question-dropdown">' +
                '<button type="button" class="btn btn-sm btn-outline-glow dropdown-toggle" data-bs-toggle="dropdown"><i class="bi bi-plus-lg me-1"></i>Add Question</button>' +
                '<ul class="dropdown-menu dropdown-menu-end">' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'mcq\')"><i class="bi bi-ui-radios me-2"></i>Multiple Choice</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'short\')"><i class="bi bi-input-cursor-text me-2"></i>Short Answer</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'long\')"><i class="bi bi-textarea-resize me-2"></i>Long Answer</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'checkbox\')"><i class="bi bi-check2-square me-2"></i>Checkbox</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'rating\')"><i class="bi bi-star-fill me-2"></i>Rating Scale</a></li>' +
                    '<li><hr class="dropdown-divider" style="border-color: rgba(255,255,255,0.1);"></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'dropdown\')"><i class="bi bi-menu-button-wide me-2"></i>Dropdown</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'yesno\')"><i class="bi bi-toggle-on me-2"></i>Yes/No</a></li>' +
                    '<li><a class="dropdown-item" href="#" onclick="addQuestion(\'datetime\')"><i class="bi bi-calendar-time me-2"></i>Date/Time</a></li>' +
                '</ul>' +
            '</div>' +
        '</div>';

    container.appendChild(block);
    updateEmptyMessage();
    updateAddQuestionButtonsVisibility();
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    block.style.animation = 'fadeInUp 0.4s ease forwards';
}

function removeQuestion(index) {
    const block = document.getElementById('question-' + index);
    if (block) {
        block.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(function () {
            block.remove();
            updateEmptyMessage();
            updateAddQuestionButtonsVisibility();
        }, 300);
    }
}

function addOption(questionIndex) {
    const container = document.getElementById('options-' + questionIndex);
    const addBtn = container.querySelector('.add-option-btn');
    const newIndex = container.querySelectorAll('.option-row').length;

    const optionRow = document.createElement('div');
    optionRow.className = 'option-row';
    optionRow.id = 'option-' + questionIndex + '-' + Date.now();
    optionRow.innerHTML =
        '<span class="text-muted" style="font-size:0.8rem;min-width:20px;">' + (newIndex + 1) + '.</span>' +
        '<input type="text" class="form-control form-control-sm" name="questions[' + questionIndex + '][options][]" placeholder="Option ' + (newIndex + 1) + '">' +
        '<button type="button" class="remove-option-btn" onclick="this.parentElement.remove()" title="Remove"><i class="bi bi-x-circle"></i></button>';

    container.insertBefore(optionRow, addBtn);
}

function removeOption(questionIndex, optionIndex) {
    const row = document.getElementById('option-' + questionIndex + '-' + optionIndex);
    if (row) row.remove();
}

function updateEmptyMessage() {
    const container = document.getElementById('questionsContainer');
    const emptyMsg = document.getElementById('emptyQuestionsMsg');
    if (container && emptyMsg) {
        emptyMsg.style.display = container.children.length === 0 ? 'block' : 'none';
    }
}

function updateAddQuestionButtonsVisibility() {
    const blocks = document.querySelectorAll('#questionsContainer .question-block');
    blocks.forEach(function (block, idx) {
        const dropdown = block.querySelector('.add-question-dropdown');
        if (dropdown) {
            if (idx === blocks.length - 1) dropdown.classList.remove('d-none');
            else dropdown.classList.add('d-none');
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fade-out animation
const style = document.createElement('style');
style.textContent = '@keyframes fadeOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-10px); } }';
document.head.appendChild(style);
