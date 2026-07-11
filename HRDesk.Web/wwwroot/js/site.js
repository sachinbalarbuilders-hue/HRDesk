// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Global interceptor for inline confirm() calls on buttons and forms
    document.querySelectorAll('[onclick*="return confirm"], [onsubmit*="return confirm"]').forEach(el => {
        let isForm = el.tagName === 'FORM';
        let attr = isForm ? 'onsubmit' : 'onclick';
        let code = el.getAttribute(attr);
        
        let match = code.match(/return confirm\s*\(\s*['"](.*?)['"]\s*\)/);
        if (match) {
            let message = match[1];
            el.removeAttribute(attr);
            
            let handler = function(e) {
                e.preventDefault();
                Swal.fire({
                    title: 'Are you sure?',
                    text: message,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Yes, proceed!',
                    backdrop: 'rgba(0,0,0,0.4)'
                }).then((result) => {
                    if (result.isConfirmed) {
                        if (!isForm && el.type === 'submit' && el.form) {
                            if (el.name) {
                                let hidden = document.createElement('input');
                                hidden.type = 'hidden';
                                hidden.name = el.name;
                                hidden.value = el.value || '';
                                el.form.appendChild(hidden);
                            }
                            el.form.submit();
                        } else if (isForm) {
                            el.submit();
                        }
                    }
                });
            };

            if (isForm) {
                el.addEventListener('submit', handler);
            } else {
                el.addEventListener('click', handler);
            }
        }
    });

    // Fix for Bootstrap dropdowns getting clipped inside .table-responsive containers
    document.addEventListener('show.bs.dropdown', function (e) {
        let tableResponsive = e.target.closest('.table-responsive');
        if (tableResponsive) {
            // Store the original overflow value
            tableResponsive.dataset.originalOverflow = getComputedStyle(tableResponsive).overflow;
            tableResponsive.style.overflow = 'visible';
        }
    });

    document.addEventListener('hide.bs.dropdown', function (e) {
        let tableResponsive = e.target.closest('.table-responsive');
        if (tableResponsive) {
            tableResponsive.style.overflow = '';
        }
    });
});
