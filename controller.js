// controller.js
// Controlador: coordina la interacción entre modelo y vista

window.AppController = class AppController {
    constructor() {
        try {
            this.modelManager = new window.ModelManager();
            this.viewManager = new window.ViewManager();
            this.isRendering = false;
            this.keydownHandler = null;
            this.viewManager.initialize();
            this.init();
        } catch (error) {
            const sanitizedMessage = String(error.message || 'Error desconocido').replace(/[\r\n]/g, ' ');
            console.error('Error en constructor AppController:', sanitizedMessage);
            this.cleanup();
            throw error;
        }
    }

    cleanup() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    async init() {
        await this.modelManager.detectAvailableModels();
        this.updateView();
        this.setupEvents();
    }

    updateView() {
        const currentUrl = this.modelManager.getCurrentModelUrl();
        this.viewManager.updateModelNumber(this.modelManager.currentIndex, this.modelManager.availableModels.length);
        // Habilitar/deshabilitar botones según el estado
        if (this.viewManager.nextBtn) {
            this.viewManager.nextBtn.disabled = (this.modelManager.currentIndex >= this.modelManager.availableModels.length - 1);
        }
        if (this.viewManager.prevBtn) {
            this.viewManager.prevBtn.disabled = (this.modelManager.currentIndex <= 0);
        }
        if (this.viewManager.modelNumberInput) {
            this.viewManager.modelNumberInput.disabled = (this.modelManager.availableModels.length <= 1);
            this.viewManager.modelNumberInput.min = 1;
            this.viewManager.modelNumberInput.max = this.modelManager.availableModels.length;
            this.viewManager.modelNumberInput.value = this.modelManager.currentIndex + 1;
        }
        // Animación de transición para el modelo 3D
        if (this.viewManager.canvas3d) {
            this.viewManager.canvas3d.classList.remove('fade-in');
            // Usar requestAnimationFrame en lugar de forzar reflow
            requestAnimationFrame(() => {
                this.viewManager.canvas3d.classList.add('fade-in');
            });
        }
        // Renderiza el modelo 3D y las vistas ortogonales con control de estado
        if (!this.isRendering) {
            this.isRendering = true;
            this.viewManager.render3D(currentUrl).catch((error) => {
                const sanitizedMessage = String(error.message || 'Error desconocido').replace(/[\r\n]/g, ' ');
                console.error('Error en renderizado:', sanitizedMessage);
            }).finally(() => {
                this.isRendering = false;
            });
        }
    }

    handleNext() {
        if (this.modelManager.nextModel()) {
            this.updateView();
        }
    }

    handlePrev() {
        if (this.modelManager.prevModel()) {
            this.updateView();
        }
    }

    // Métodos auxiliares para validación de navegación
    canNavigateNext() {
        return this.viewManager.nextBtn && 
               !this.viewManager.nextBtn.disabled && 
               this.modelManager.currentIndex < this.modelManager.availableModels.length - 1;
    }

    canNavigatePrev() {
        return this.viewManager.prevBtn && 
               !this.viewManager.prevBtn.disabled && 
               this.modelManager.currentIndex > 0;
    }

    isValidModelIndex(idx) {
        return idx >= 0 && idx < this.modelManager.availableModels.length;
    }

    setupEvents() {
        if (this.viewManager.nextBtn) {
            this.viewManager.nextBtn.addEventListener('click', () => this.handleNext());
        }
        if (this.viewManager.prevBtn) {
            this.viewManager.prevBtn.addEventListener('click', () => this.handlePrev());
        }
        if (this.viewManager.modelNumberInput) {
            this.viewManager.modelNumberInput.addEventListener('change', (e) => {
                const parsedValue = parseInt(e.target.value, 10);
                if (Number.isNaN(parsedValue)) {
                    e.target.value = this.modelManager.currentIndex + 1;
                    return;
                }
                const idx = parsedValue - 1;
                // Validación mejorada
                if (this.isValidModelIndex(idx)) {
                    this.modelManager.setCurrentIndex(idx);
                    this.updateView();
                } else {
                    // Restaurar valor válido si la entrada es inválida
                    e.target.value = this.modelManager.currentIndex + 1;
                }
            });
        }

        // Añadir navegación por teclado con validación
        this.keydownHandler = (e) => {
            // Solo actuar si no se está escribiendo en el input
            if (document.activeElement === this.viewManager.modelNumberInput) {
                return;
            }

            // Validación de autorización simplificada usando métodos auxiliares
            if (e.key === 'ArrowRight' && this.canNavigateNext()) {
                e.preventDefault();
                this.handleNext();
            } else if (e.key === 'ArrowLeft' && this.canNavigatePrev()) {
                e.preventDefault();
                this.handlePrev();
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }
}
