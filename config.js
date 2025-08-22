// config.js
// Configuración global de la aplicación

window.AppConfig = {
    // Rutas y límites
    MODEL_PATH: 'models/',
    MAX_MODELS: 100,
    
    // Animaciones
    ANIMATION_DURATION: 1.5,
    
    // IDs de elementos DOM
    CANVAS_IDS: {
        main: 'canvas-3d',
        top: 'canvas-top',
        front: 'canvas-front',
        side: 'canvas-side'
    },
    
    CONTROL_IDS: {
        modelInput: 'goto-model',
        nextBtn: 'next-model',
        prevBtn: 'prev-model',
        currentLabel: 'current-model'
    },
    
    // Configuración 3D (movido desde view.js)
    SCENE_3D: {
        GRID_SIZE: 10,
        MAIN_LIGHT_POS: [10, 10, 5],
        MAIN_LIGHT_INTENSITY: 0.9,
        FILL_LIGHT_POS: [-5, -5, -5],
        FILL_LIGHT_INTENSITY: 0.4
    },
    
    ORTHOGRAPHIC: {
        MARGIN_FACTOR: 0.6,
        SIZE: 5,
        LIGHT_INTENSITY: 1.1,
        FILL_INTENSITY: 0.3
    }
};