// model.js
// Modelo: gestiona la carga y el estado de los modelos 3D

window.ModelManager = class ModelManager {
    constructor(modelPath = window.AppConfig.MODEL_PATH, maxModels = window.AppConfig.MAX_MODELS) {
        this.modelPath = modelPath;
        this.maxModels = maxModels;
        this.availableModels = [];
        this.currentIndex = 0;
    }

    async detectAvailableModels() {
        this.availableModels = [];
        try {
            const response = await fetch(this.modelPath + 'manifest.json');
            if (!response.ok) throw new Error('No se pudo cargar manifest.json');
            const manifest = await response.json();
            if (manifest.models && Array.isArray(manifest.models) && manifest.models.length > 0) {
                this.availableModels = manifest.models;
            } else {
                this.availableModels.push(null);
            }
        } catch (e) {
            const sanitizedMessage = String(e.message || 'Error desconocido').replace(/[\r\n]/g, ' ');
            if (e.name === 'TypeError') {
                console.warn('Error de estructura en manifest:', sanitizedMessage);
            } else if (e.name === 'SyntaxError') {
                console.warn('Error de formato JSON:', sanitizedMessage);
            } else {
                console.warn('Error de red o acceso:', sanitizedMessage);
            }
            this.availableModels.push(null);
        }
    }

    getCurrentModelUrl() {
        return this.availableModels[this.currentIndex] || null;
    }

    setCurrentIndex(index) {
        if (index >= 0 && index < this.availableModels.length) {
            this.currentIndex = index;
            return true;
        }
        return false;
    }

    nextModel() {
        if (this.currentIndex < this.availableModels.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    prevModel() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }
}
