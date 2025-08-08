// assets/js/contact-form-secure-ultimate.js - Versión más segura y compatible
(function() {
    'use strict';
    
    // Prevenir conflictos con otros scripts
    const NUTRIEN_CONTACT = {
        form: null,
        submitBtn: null,
        csrfToken: null,
        isInitialized: false
    };
    
    class SecureContactForm {
        constructor() {
            // Esperar a que todos los scripts se carguen
            this.initTimeout = null;
            this.retryCount = 0;
            this.maxRetries = 10;
            
            this.safeInit();
        }
        
        safeInit() {
            // Limpiar timeout anterior
            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
            }
            
            // Verificar si el DOM está listo y tiny-slider no está interfiriendo
            if (document.readyState === 'loading' || this.retryCount < 3) {
                this.initTimeout = setTimeout(() => {
                    this.retryCount++;
                    this.safeInit();
                }, 200);
                return;
            }
            
            try {
                this.form = document.querySelector('.contact-form');
                
                if (!this.form) {
                    console.log('Formulario de contacto no encontrado');
                    return;
                }
                
                this.submitBtn = this.form.querySelector('button[type="submit"]');
                this.csrfToken = null;
                
                this.init();
                
            } catch (error) {
                console.error('Error inicializando formulario:', error);
                
                // Reintentar si no hemos alcanzado el máximo
                if (this.retryCount < this.maxRetries) {
                    this.initTimeout = setTimeout(() => {
                        this.retryCount++;
                        this.safeInit();
                    }, 500);
                }
            }
        }
        
        async init() {
            if (NUTRIEN_CONTACT.isInitialized) {
                return; // Ya está inicializado
            }
            
            try {
                // Obtener token CSRF
                await this.getCSRFToken();
                
                if (!this.csrfToken) {
                    throw new Error('No se pudo obtener token CSRF');
                }
                
                // Agregar campo CSRF oculto
                this.addCSRFField();
                
                // Configurar validación
                this.setupValidation();
                
                // Configurar envío del formulario
                this.setupFormSubmission();
                
                // Marcar como inicializado
                NUTRIEN_CONTACT.isInitialized = true;
                NUTRIEN_CONTACT.form = this.form;
                NUTRIEN_CONTACT.submitBtn = this.submitBtn;
                NUTRIEN_CONTACT.csrfToken = this.csrfToken;
                
                console.log('Formulario de contacto inicializado correctamente');
                
            } catch (error) {
                console.error('Error en inicialización:', error);
                this.showMessage('Error de inicialización. Recargue la página.', 'error');
            }
        }
        
        async getCSRFToken() {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                
                const response = await fetch('assets/php/get-csrf-token.php', {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Respuesta no es JSON válido');
                }
                
                const data = await response.json();
                
                if (data.success && data.csrf_token) {
                    this.csrfToken = data.csrf_token;
                } else {
                    throw new Error(data.error || 'Token CSRF inválido');
                }
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Timeout obteniendo token CSRF');
                }
                console.error('Error CSRF:', error);
                throw error;
            }
        }
        
        addCSRFField() {
            if (!this.csrfToken || !this.form) return;
            
            // Remover campo existente
            const existingField = this.form.querySelector('input[name="csrf_token"]');
            if (existingField) {
                existingField.remove();
            }
            
            // Crear nuevo campo CSRF
            const csrfField = document.createElement('input');
            csrfField.type = 'hidden';
            csrfField.name = 'csrf_token';
            csrfField.value = this.csrfToken;
            csrfField.setAttribute('data-nutrien-csrf', 'true');
            
            this.form.appendChild(csrfField);
        }
        
        setupValidation() {
            if (!this.form) return;
            
            const fields = this.getFormFields();
            
            // Validación en tiempo real con debounce
            Object.entries(fields).forEach(([fieldName, field]) => {
                if (field) {
                    let validationTimeout;
                    
                    const debouncedValidation = () => {
                        clearTimeout(validationTimeout);
                        validationTimeout = setTimeout(() => {
                            this.validateField(fieldName, field);
                        }, 300);
                    };
                    
                    field.addEventListener('blur', () => this.validateField(fieldName, field));
                    field.addEventListener('input', () => {
                        this.clearFieldError(field);
                        debouncedValidation();
                    });
                }
            });
        }
        
        getFormFields() {
            return {
                name: this.form.querySelector('input[name="name"]'),
                phone: this.form.querySelector('input[name="phone"]'), 
                email: this.form.querySelector('input[name="email"]'), 
                subject: this.form.querySelector('input[name="subject"]'),
                message: this.form.querySelector('textarea[name="message"]')
            };
        }
        
        validateField(fieldName, field) {
            if (!field) return false;
            
            const value = field.value.trim();
            let isValid = true;
            let message = '';
            
            // Validaciones específicas mejoradas
            switch (fieldName) {
                case 'name':
                    if (!value) {
                        isValid = false;
                        message = 'Nombre es requerido';
                    } else if (value.length < 2) {
                        isValid = false;
                        message = 'Nombre debe tener al menos 2 caracteres';
                    } else if (value.length > 100) {
                        isValid = false;
                        message = 'Nombre no puede exceder 100 caracteres';
                    } else if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/.test(value)) {
                        isValid = false;
                        message = 'Nombre solo puede contener letras y espacios';
                    }
                    break;
                    
                case 'email':
                    if (!value) {
                        isValid = false;
                        message = 'Email es requerido';
                    } else {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(value)) {
                            isValid = false;
                            message = 'Formato de email inválido';
                        } else if (value.length > 254) {
                            isValid = false;
                            message = 'Email demasiado largo';
                        }
                    }
                    break;
                    
                case 'phone':
                    // Teléfono es opcional, pero si se proporciona debe ser válido
                    if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
                        isValid = false;
                        message = 'Formato de teléfono inválido';
                    }
                    break;
                    
                case 'subject':
                    if (!value) {
                        isValid = false;
                        message = 'Asunto es requerido';
                    } else if (value.length < 3) {
                        isValid = false;
                        message = 'Asunto debe tener al menos 3 caracteres';
                    } else if (value.length > 200) {
                        isValid = false;
                        message = 'Asunto no puede exceder 200 caracteres';
                    }
                    break;
                    
                case 'message':
                    if (!value) {
                        isValid = false;
                        message = 'Mensaje es requerido';
                    } else if (value.length < 15) {
                        isValid = false;
                        message = 'Mensaje debe tener al menos 15 caracteres';
                    } else if (value.length > 2000) {
                        isValid = false;
                        message = 'Mensaje no puede exceder 2000 caracteres';
                    }
                    break;
            }
            
            if (!isValid) {
                this.showFieldError(field, message);
            } else {
                this.clearFieldError(field);
            }
            
            return isValid;
        }
        
        showFieldError(field, message) {
            if (!field) return;
            
            this.clearFieldError(field);
            
            field.classList.add('error');
            field.setAttribute('aria-invalid', 'true');
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.setAttribute('data-field-error', field.name);
            errorDiv.textContent = message;
            
            field.parentNode.appendChild(errorDiv);
        }
        
        clearFieldError(field) {
            if (!field) return;
            
            field.classList.remove('error');
            field.setAttribute('aria-invalid', 'false');
            
            const errorDiv = field.parentNode.querySelector(`[data-field-error="${field.name}"]`);
            if (errorDiv) {
                errorDiv.remove();
            }
        }
        
        setupFormSubmission() {
            if (!this.form) return;
            
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.handleSubmit(e);
            });
        }
        
        async handleSubmit(event) {
            if (!this.form) return;
            
            // Validar todos los campos
            const fields = this.getFormFields();
            let hasErrors = false;
            
            Object.entries(fields).forEach(([fieldName, field]) => {
                if (field && !this.validateField(fieldName, field)) {
                    hasErrors = true;
                }
            });
            
            if (hasErrors) {
                this.showMessage('Por favor corrija los errores en el formulario', 'error');
                return;
            }
            
            // Verificar que tenemos token CSRF
            if (!this.csrfToken) {
                try {
                    await this.getCSRFToken();
                    this.addCSRFField();
                } catch (error) {
                    this.showMessage('Error de seguridad. Recargue la página.', 'error');
                    return;
                }
            }
            
            // Deshabilitar botón y mostrar estado de carga
            this.setSubmitButton(false, 'Enviando...');
            
            try {
                const formData = new FormData(this.form);
                
                // Verificar que el token CSRF está incluido
                if (!formData.get('csrf_token')) {
                    throw new Error('Token CSRF faltante');
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
                
                const response = await fetch('assets/php/mail.php', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                let result;
                try {
                    const text = await response.text();
                    result = JSON.parse(text);
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    throw new Error('Respuesta del servidor inválida');
                }
                
                if (response.ok && result.success) {
                    this.showMessage(result.message, 'success');
                    this.form.reset();
                    this.clearAllFieldErrors();
                    
                    // Obtener nuevo token para próximo envío
                    try {
                        await this.getCSRFToken();
                        this.addCSRFField();
                    } catch (tokenError) {
                        console.warn('No se pudo renovar token CSRF:', tokenError);
                    }
                    
                } else {
                    this.showMessage(result.message || 'Error al enviar el mensaje', 'error');
                    
                    // Si es error de token, intentar renovar
                    if (result.message && result.message.includes('Token')) {
                        try {
                            await this.getCSRFToken();
                            this.addCSRFField();
                        } catch (tokenError) {
                            console.warn('No se pudo renovar token CSRF:', tokenError);
                        }
                    }
                }
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    this.showMessage('Timeout enviando mensaje. Intente nuevamente.', 'error');
                } else {
                    console.error('Error enviando formulario:', error);
                    this.showMessage('Error de conexión. Verifique su internet e intente nuevamente.', 'error');
                }
            } finally {
                this.setSubmitButton(true, 'ENVIAR');
            }
        }
        
        clearAllFieldErrors() {
            const fields = this.getFormFields();
            Object.values(fields).forEach(field => {
                if (field) {
                    this.clearFieldError(field);
                }
            });
        }
        
        setSubmitButton(enabled, text) {
            if (this.submitBtn) {
                this.submitBtn.disabled = !enabled;
                this.submitBtn.textContent = text;
                this.submitBtn.classList.toggle('sending', !enabled);
                this.submitBtn.setAttribute('aria-busy', !enabled);
            }
        }
        
        showMessage(message, type) {
            // Remover mensaje anterior
            const existing = document.querySelector('.nutrien-form-message');
            if (existing) {
                existing.remove();
            }
            
            // Crear nuevo mensaje
            const messageDiv = document.createElement('div');
            messageDiv.className = `nutrien-form-message ${type}`;
            messageDiv.setAttribute('role', type === 'error' ? 'alert' : 'status');
            messageDiv.setAttribute('aria-live', 'polite');
            messageDiv.textContent = message;
            
            // Insertar antes del formulario
            this.form.parentNode.insertBefore(messageDiv, this.form);
            
            // Auto-remover después de tiempo apropiado
            const timeout = type === 'success' ? 8000 : 12000;
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, timeout);
            
            // Scroll suave al mensaje
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    // Función de inicialización segura
    function initContactForm() {
        // Verificar que no hay otra instancia ejecutándose
        if (window.nutrienContactForm) {
            return;
        }
        
        try {
            window.nutrienContactForm = new SecureContactForm();
        } catch (error) {
            console.error('Error creando formulario de contacto:', error);
        }
    }
    
    // Inicializar cuando sea seguro
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContactForm);
    } else {
        // Pequeño delay para evitar conflictos con tiny-slider
        setTimeout(initContactForm, 100);
    }
    
    // CSS mejorado
    const styles = `
        .contact-form input.error,
        .contact-form textarea.error {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
        }
        
        .contact-form button.sending {
            opacity: 0.6;
            cursor: not-allowed;
            position: relative;
        }
        
        .contact-form button.sending::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            margin: auto;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }
        
        .field-error {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
            animation: slideDown 0.3s ease-out;
        }
        
        .nutrien-form-message {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            text-align: center;
            font-weight: 500;
            animation: fadeIn 0.3s ease-in;
        }
        
        .nutrien-form-message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .nutrien-form-message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    
    // Agregar CSS al documento
    if (!document.querySelector('#nutrien-contact-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'nutrien-contact-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
})();