// view.js
// Vista: gestiona el renderizado y la interfaz de usuario

window.ViewManager = class ViewManager {
    constructor() {
        // Usar objetos globales de Three.js
        this.THREE = window.THREE;
        this.OrbitControls = window.OrbitControls;
        this.GLTFLoader = window.THREE && window.THREE.GLTFLoader ? window.THREE.GLTFLoader : null;
        this.loader = null; // Instancia reutilizable de GLTFLoader
        this.needsRender = false; // Flag para renderizado basado en eventos
        this.containerCache = {}; // Cache de contenedores DOM
        this.cameraKeys = null; // Cache for camera keys
        this.sceneKeys = null; // Cache for scene keys
        this.sceneValues = null; // Cache for scene values
        this.sharedBox = null; // Reusable Box3
        this.sharedCenter = null; // Reusable Vector3
        this.sharedSize = null; // Reusable Vector3
        this.boundRender = null; // Bound render method
        this.rendererKeys = null; // Cache for renderer keys
        this.gridSize = null; // Cache for grid size

        // Propiedades para escenas y renderizadores
        this.scene3D = null;
        this.camera3D = null;
        this.renderer3D = null;
        this.controls = null;
        this.scenes = { top: null, front: null, side: null };
        this.cameras = { top: null, front: null, side: null };
        this.renderers = { top: null, front: null, side: null };
        this.currentModel = null;
        this.animationStarted = false;
    }

    initialize() {
        if (!window.AppConfig) {
            console.error('AppConfig no está disponible');
            return;
        }
        const config = window.AppConfig;
        // Batch DOM queries para mejor rendimiento
        const elements = {
            canvas3d: config.CANVAS_IDS.main,
            canvasTop: config.CANVAS_IDS.top,
            canvasFront: config.CANVAS_IDS.front,
            canvasSide: config.CANVAS_IDS.side,
            modelNumberInput: config.CONTROL_IDS.modelInput,
            nextBtn: config.CONTROL_IDS.nextBtn,
            prevBtn: config.CONTROL_IDS.prevBtn,
            currentModelLabel: config.CONTROL_IDS.currentLabel
        };

        // Direct assignment with validation to prevent prototype pollution
        Object.entries(elements).forEach(([key, elementId]) => {
            if (elements.hasOwnProperty(key) && typeof elementId === 'string') {
                this[key] = document.getElementById(elementId);
            }
        });

        // Inicializar loader reutilizable
        if (this.GLTFLoader) {
            this.loader = new this.GLTFLoader();
        }

        // Mapeo de canvas para evitar acceso dinámico complejo
        this.canvasMap = {
            top: this.canvasTop,
            front: this.canvasFront,
            side: this.canvasSide
        };

        // Inicializar solo si los canvas existen
        if (this.canvas3d && this.canvasTop && this.canvasFront && this.canvasSide) {
            this.init3D();
            this.initOrthogonal();
            // Usar renderizado basado en eventos en lugar de animación continua
            this.markNeedsRender();
        } else {
            console.error('No se encontraron los canvas necesarios en el DOM');
        }
    }

    updateModelNumber(current, total) {
        if (this.modelNumberInput) {
            this.modelNumberInput.value = current + 1;
            this.modelNumberInput.max = total;
        }
        if (this.currentModelLabel) {
            this.currentModelLabel.textContent = `${current + 1}/${total}`;
        }
    }

    showError(message) {
        // Sanitizar mensaje para prevenir log injection sin overhead de encodeURIComponent
        const sanitizedMessage = (typeof message === 'string' ? message : String(message)).replace(/[\r\n]/g, ' ');
        console.error('Error:', sanitizedMessage);
    }

    // Marcar que se necesita renderizado
    markNeedsRender() {
        if (!this.needsRender) {
            this.needsRender = true;
            if (!this.boundRender) {
                this.boundRender = this.render.bind(this);
            }
            requestAnimationFrame(this.boundRender);
        }
    }

    // Renderizado basado en eventos
    render() {
        if (!this.needsRender || !this.renderer3D || !this.scene3D || !this.camera3D) return;

        if (this.controls && this.controls.enabled) {
            this.controls.update();
        }

        this.renderer3D.render(this.scene3D, this.camera3D);

        // Usar renderer keys cacheadas

        this.rendererKeys.forEach(key => {
            if (this.renderers[key] && this.scenes[key] && this.cameras[key]) {
                this.renderers[key].render(this.scenes[key], this.cameras[key]);
            }
        });

        this.needsRender = false;
    }

    // Método centralizado para crear modelo de respaldo
    createFallbackModel() {
        const THREE = this.THREE;
        const geometry = new THREE.BoxGeometry(2, 3, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x4CAF50 });
        return new THREE.Mesh(geometry, material);
    }

    // Método para ajustar cámaras ortográficas (evita duplicación)
    adjustOrthographicCameras(maxDim) {
        const margin = maxDim * window.AppConfig.ORTHOGRAPHIC.MARGIN_FACTOR;

        // Cache camera keys para evitar Object.keys() repetido
        if (!this.cameraKeys) {
            this.cameraKeys = Object.keys(this.cameras);
        }

        this.cameraKeys.forEach(key => {
            const camera = this.cameras[key];
            const canvas = this.canvasMap[key];
            if (canvas && camera) {
                // Usar container cacheado si existe
                const container = this.containerCache[key] || canvas.parentElement;
                if (!this.containerCache[key]) {
                    this.containerCache[key] = container;
                }
                const aspect = container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
                camera.left = -margin * aspect;
                camera.right = margin * aspect;
                camera.top = margin;
                camera.bottom = -margin;
                camera.updateProjectionMatrix();
            }
        });
        this.markNeedsRender();
    }

    // Métodos para renderizar los canvas y actualizar la UI
    // Inicialización del visor 3D principal
    init3D() {
        if (!this.canvas3d) return;
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLighting();
    }

    setupScene() {
        this.scene3D = new this.THREE.Scene();
        this.scene3D.background = new this.THREE.Color(0xf0f0f0);
        // Cache grid size para evitar accesos redundantes
        if (!this.gridSize) {
            this.gridSize = window.AppConfig.SCENE_3D.GRID_SIZE;
        }
        this.scene3D.add(new this.THREE.GridHelper(this.gridSize, this.gridSize));
    }

    setupCamera() {
        const container = this.canvas3d.parentElement;
        this.containerCache.main = container; // Cache container
        this.camera3D = new this.THREE.PerspectiveCamera(
            75,
            container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1,
            0.1,
            1000
        );
        this.camera3D.position.set(...window.AppConfig.SCENE_3D.MAIN_LIGHT_POS);
    }

    setupRenderer() {
        const container = this.containerCache.main;
        this.renderer3D = new this.THREE.WebGLRenderer({
            canvas: this.canvas3d,
            antialias: true
        });
        this.renderer3D.setSize(container.clientWidth, container.clientHeight);
        this.renderer3D.shadowMap.enabled = true;
        this.renderer3D.shadowMap.type = this.THREE.PCFSoftShadowMap;
        // Optimizar configuración de sombras
        this.renderer3D.shadowMap.autoUpdate = false;
    }

    setupControls() {
        this.controls = new this.THREE.OrbitControls(this.camera3D, this.canvas3d);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        // Agregar listener para marcar renderizado necesario
        this.controls.addEventListener('change', () => this.markNeedsRender());
    }

    setupLighting() {
        this.scene3D.add(new this.THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new this.THREE.DirectionalLight(0xffffff, window.AppConfig.SCENE_3D.MAIN_LIGHT_INTENSITY);
        dirLight.position.set(...window.AppConfig.SCENE_3D.MAIN_LIGHT_POS);
        dirLight.castShadow = true;
        this.scene3D.add(dirLight);
        const fillLight = new this.THREE.DirectionalLight(0xffffff, window.AppConfig.SCENE_3D.FILL_LIGHT_INTENSITY);
        fillLight.position.set(...window.AppConfig.SCENE_3D.FILL_LIGHT_POS);
        this.scene3D.add(fillLight);
    }

    // Inicialización de vistas ortogonales
    initOrthogonal() {
        const configs = [
            { canvas: this.canvasTop, key: 'top', position: [0, 10, 0], up: [0, 0, -1] },
            { canvas: this.canvasFront, key: 'front', position: [0, 0, 10], up: [0, 1, 0] },
            { canvas: this.canvasSide, key: 'side', position: [10, 0, 0], up: [0, 1, 0] }
        ];

        // Pre-calcular vectores normalizados para reutilizar
        const normalizedVectors = configs.map(cfg => ({
            ...cfg,
            dirPos: new this.THREE.Vector3(...cfg.position).normalize().multiplyScalar(10),
            fillPos: new this.THREE.Vector3(-cfg.position[0] * 0.5, -cfg.position[1] * 0.5, -cfg.position[2] * 0.5).normalize().multiplyScalar(8)
        }));

        normalizedVectors.forEach(cfg => {
            if (!cfg.canvas) return;
            const container = cfg.canvas.parentElement;
            this.containerCache[cfg.key] = container; // Cache container

            this.scenes[cfg.key] = new this.THREE.Scene();
            this.scenes[cfg.key].background = new this.THREE.Color(0xffffff);
            this.scenes[cfg.key].add(new this.THREE.AmbientLight(0xffffff, 0.9));

            // Usar vectores pre-calculados
            const dirLight = new this.THREE.DirectionalLight(0xffffff, window.AppConfig.ORTHOGRAPHIC.LIGHT_INTENSITY);
            dirLight.position.copy(cfg.dirPos);
            dirLight.castShadow = false; // Deshabilitar sombras para luz de relleno
            this.scenes[cfg.key].add(dirLight);

            const fillLight = new this.THREE.DirectionalLight(0xffffff, window.AppConfig.ORTHOGRAPHIC.FILL_INTENSITY);
            fillLight.position.copy(cfg.fillPos);
            fillLight.castShadow = false; // Deshabilitar sombras para luz de relleno
            this.scenes[cfg.key].add(fillLight);

            const aspect = container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
            const size = window.AppConfig.ORTHOGRAPHIC.SIZE;
            const left = -size * aspect;
            const right = size * aspect;
            const top = size;
            const bottom = -size;
            this.cameras[cfg.key] = new this.THREE.OrthographicCamera(left, right, top, bottom, 0.1, 100);
            this.cameras[cfg.key].position.set(...cfg.position);
            this.cameras[cfg.key].up.set(...cfg.up);
            this.cameras[cfg.key].lookAt(0, 0, 0);
            this.renderers[cfg.key] = new this.THREE.WebGLRenderer({
                canvas: cfg.canvas,
                antialias: true
            });
            this.renderers[cfg.key].setSize(container.clientWidth, container.clientHeight);
        });

        // Inicializar cache de renderer keys
        this.rendererKeys = Object.keys(this.renderers);
    }

    // Renderiza el modelo principal en la escena 3D
    async render3D(modelUrl) {
        const THREE = this.THREE;
        // Limpiar modelo anterior y liberar recursos
        if (this.currentModel) {
            this.currentModel.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
            this.scene3D.remove(this.currentModel);
        }
        // Reiniciar cámara y controles al cambiar de modelo
        if (this.camera3D && this.controls) {
            const [x, y, z] = window.AppConfig.SCENE_3D.MAIN_LIGHT_POS;
            this.camera3D.position.set(x, y, z);
            this.camera3D.lookAt(0, 0, 0);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        if (!modelUrl) {
            this.currentModel = this.createFallbackModel();
            this.scene3D.add(this.currentModel);
            this.centerModel();
            this.renderOrthogonalViews(null);
            this.markNeedsRender();
            return Promise.resolve();
        }
        // Usar loader reutilizable
        if (!this.loader) {
            this.showError('GLTFLoader no disponible');
            return Promise.reject(new Error('GLTFLoader no disponible'));
        }
        return new Promise((resolve, reject) => {
            this.loader.load(
                modelUrl,
                (gltf) => {
                    this.currentModel = gltf.scene;
                    this.currentModel.name = 'model';

                    // Cache material properties para evitar modificaciones redundantes
                    const materialCache = new Map();

                    this.currentModel.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;

                            if (child.material) {
                                const materialKey = child.material.uuid;
                                if (!materialCache.has(materialKey)) {
                                    if (child.material.color) {
                                        const color = child.material.color;
                                        const DARK_COLOR_THRESHOLD = window.AppConfig.MATERIAL?.DARK_THRESHOLD || 0.2;
                                        const BRIGHTNESS_MULTIPLIER = window.AppConfig.MATERIAL?.BRIGHTNESS_MULTIPLIER || 2.5;
                                        if (color.r < DARK_COLOR_THRESHOLD && color.g < DARK_COLOR_THRESHOLD && color.b < DARK_COLOR_THRESHOLD) {
                                            child.material.color.multiplyScalar(BRIGHTNESS_MULTIPLIER);
                                        }
                                    }
                                    if (child.material.type === 'MeshStandardMaterial') {
                                        child.material.roughness = 0.8;
                                        child.material.metalness = 0.0;
                                        child.material.needsUpdate = true;
                                    }
                                    materialCache.set(materialKey, {
                                        processed: true,
                                        color: child.material.color?.clone(),
                                        roughness: child.material.roughness,
                                        metalness: child.material.metalness
                                    });
                                }
                            }
                        }
                    });

                                        this.scene3D.add(this.currentModel);
                    this.centerModel();
                    this.renderOrthogonalViews(modelUrl);
                    this.markNeedsRender();
                    // Animación de transición para el modelo 3D
                    if (this.canvas3d) {
                        this.canvas3d.classList.remove('fade-in');
                        requestAnimationFrame(() => {
                            this.canvas3d.classList.add('fade-in');
                        });
                    }
                    resolve();
                },
                undefined,
                (error) => {
                    const sanitizedError = String(error.message || error).replace(/[\r\n]/g, ' ');
                    console.error('Error cargando modelo GLB:', sanitizedError);
                    this.currentModel = this.createFallbackModel();
                    this.scene3D.add(this.currentModel);
                    this.centerModel();
                    this.renderOrthogonalViews(null);
                    this.markNeedsRender();
                    resolve();
                }
            );
        });
    }

    // Renderiza los clones en las vistas ortogonales
    async renderOrthogonalViews(modelUrl) {
        const THREE = this.THREE;
        // Limpiar todos los objetos previos en cada escena ortogonal y liberar recursos
        Object.values(this.scenes).forEach(scene => {
            for (let i = scene.children.length - 1; i >= 0; i--) {
                const obj = scene.children[i];
                if (obj.name === 'model') {
                    obj.traverse((child) => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (child.material.map) child.material.map.dispose();
                                child.material.dispose();
                            }
                        }
                    });
                    scene.remove(obj);
                }
            }
        });

        // Usar modelo actual o crear uno de respaldo una sola vez
        const modelToClone = (!modelUrl || !this.currentModel) ? this.createFallbackModel() : this.currentModel;

        // Reutilizar objetos Box3 y Vector3 para evitar creaciones repetidas
        if (!this.sharedBox) {
            this.sharedBox = new this.THREE.Box3();
            this.sharedCenter = new this.THREE.Vector3();
            this.sharedSize = new this.THREE.Vector3();
        }

        // Calcular dimensiones una sola vez
        this.sharedBox.setFromObject(modelToClone);
        const center = this.sharedBox.getCenter(this.sharedCenter);
        const size = this.sharedBox.getSize(this.sharedSize);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Cache scene keys para evitar Object.keys() repetido
        if (!this.sceneKeys) {
            this.sceneKeys = Object.keys(this.scenes);
        }

        // Optimizar clonación usando geometría compartida cuando sea posible
        this.sceneKeys.forEach(key => {
            const clone = modelToClone.clone();
            clone.name = 'model';
            // Usar la posición ya centrada del modelo principal si existe
            if (this.currentModel && modelToClone === this.currentModel) {
                clone.position.copy(this.currentModel.position);
            } else {
                // Para modelos de respaldo, centrar manualmente
                clone.position.sub(center);
            }
            this.scenes[key].add(clone);
        });

        // Ajustar cámaras una sola vez después del bucle
        this.adjustOrthographicCameras(maxDim);
        this.markNeedsRender();
        return Promise.resolve();
    }

    // Centra el modelo y ajusta cámaras ortogonales
    centerModel() {
        if (!this.currentModel) return;

        // Reutilizar objetos compartidos para evitar duplicación con renderOrthogonalViews
        if (!this.sharedBox) {
            this.sharedBox = new this.THREE.Box3();
            this.sharedCenter = new this.THREE.Vector3();
            this.sharedSize = new this.THREE.Vector3();
        }

        this.sharedBox.setFromObject(this.currentModel);
        const center = this.sharedBox.getCenter(this.sharedCenter);
        const size = this.sharedBox.getSize(this.sharedSize);
        this.currentModel.position.sub(center);

        // Cache scene values para evitar Object.values() repetido
        if (!this.sceneValues) {
            this.sceneValues = Object.values(this.scenes);
        }

        // No necesario sincronizar posiciones aquí ya que renderOrthogonalViews se llama después

        // Ajustar distancia de cámara principal
        const maxDim = Math.max(size.x, size.y, size.z);
        this.camera3D.position.setLength(maxDim * 3);
        // Ajustar límites de cámaras ortogonales
        this.adjustOrthographicCameras(maxDim);
        this.markNeedsRender();
    }




}
