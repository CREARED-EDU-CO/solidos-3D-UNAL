// view.js
// Vista: gestiona el renderizado y la interfaz de usuario sin módulos ES.

window.ViewManager = class ViewManager {
    constructor() {
        this.THREE = window.THREE;
        this.OrbitControls = window.OrbitControls;
        this.GLTFLoader = window.THREE && window.THREE.GLTFLoader ? window.THREE.GLTFLoader : null;
        this.STLLoader = window.THREE && window.THREE.STLLoader ? window.THREE.STLLoader : null;

        this.gltfLoader = null;
        this.stlLoader = null;
        this.needsRender = false;
        this.boundRender = this.render.bind(this);
        this.boundResize = this.handleResize.bind(this);
        this.loadRequestId = 0;

        this.scene3D = null;
        this.camera3D = null;
        this.renderer3D = null;
        this.controls = null;
        this.scenes = { top: null, front: null, side: null };
        this.cameras = { top: null, front: null, side: null };
        this.renderers = { top: null, front: null, side: null };
        this.canvasMap = {};
        this.currentModel = null;

        this.technicalMaterial = null;
        this.technicalLineMaterial = null;
        this.sharedBox = null;
        this.sharedCenter = null;
        this.sharedSize = null;
    }

    initialize() {
        if (!window.AppConfig || !this.THREE || !this.OrbitControls) {
            this.showError('Dependencias de la aplicación no disponibles');
            return;
        }

        this.sharedBox = new this.THREE.Box3();
        this.sharedCenter = new this.THREE.Vector3();
        this.sharedSize = new this.THREE.Vector3();

        const config = window.AppConfig;
        this.canvas3d = document.getElementById(config.CANVAS_IDS.main);
        this.canvasTop = document.getElementById(config.CANVAS_IDS.top);
        this.canvasFront = document.getElementById(config.CANVAS_IDS.front);
        this.canvasSide = document.getElementById(config.CANVAS_IDS.side);
        this.modelNumberInput = document.getElementById(config.CONTROL_IDS.modelInput);
        this.nextBtn = document.getElementById(config.CONTROL_IDS.nextBtn);
        this.prevBtn = document.getElementById(config.CONTROL_IDS.prevBtn);
        this.currentModelLabel = document.getElementById(config.CONTROL_IDS.currentLabel);

        this.canvasMap = {
            top: this.canvasTop,
            front: this.canvasFront,
            side: this.canvasSide
        };

        if (!this.canvas3d || !this.canvasTop || !this.canvasFront || !this.canvasSide) {
            this.showError('No se encontraron los canvas necesarios en el DOM');
            return;
        }

        if (this.GLTFLoader) this.gltfLoader = new this.GLTFLoader();
        if (this.STLLoader) this.stlLoader = new this.STLLoader();

        this.init3D();
        this.initOrthogonal();
        window.addEventListener('resize', this.boundResize);
        this.markNeedsRender();
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
        const sanitizedMessage = (typeof message === 'string' ? message : String(message)).replace(/[\r\n]/g, ' ');
        console.error('Error:', sanitizedMessage);
    }

    init3D() {
        const config = window.AppConfig.SCENE_3D;
        const container = this.canvas3d.parentElement;

        this.scene3D = new this.THREE.Scene();
        this.scene3D.background = new this.THREE.Color(0xf0f0f0);
        this.scene3D.add(new this.THREE.GridHelper(config.GRID_SIZE, config.GRID_SIZE));

        this.camera3D = new this.THREE.PerspectiveCamera(75, this.getAspect(container), 0.1, 1000);
        this.camera3D.position.set(...config.MAIN_LIGHT_POS);

        this.renderer3D = this.createRenderer(this.canvas3d, container);
        this.renderer3D.shadowMap.enabled = true;
        this.renderer3D.shadowMap.type = this.THREE.PCFSoftShadowMap;
        this.renderer3D.shadowMap.autoUpdate = false;

        this.controls = new this.OrbitControls(this.camera3D, this.canvas3d);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.addEventListener('change', () => this.markNeedsRender());

        this.scene3D.add(new this.THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new this.THREE.DirectionalLight(0xffffff, config.MAIN_LIGHT_INTENSITY);
        dirLight.position.set(...config.MAIN_LIGHT_POS);
        dirLight.castShadow = true;
        this.scene3D.add(dirLight);

        const fillLight = new this.THREE.DirectionalLight(0xffffff, config.FILL_LIGHT_INTENSITY);
        fillLight.position.set(...config.FILL_LIGHT_POS);
        this.scene3D.add(fillLight);
    }

    initOrthogonal() {
        const configs = [
            { canvas: this.canvasTop, key: 'top', position: [0, 10, 0], up: [0, 0, -1] },
            { canvas: this.canvasFront, key: 'front', position: [0, 0, 10], up: [0, 1, 0] },
            { canvas: this.canvasSide, key: 'side', position: [10, 0, 0], up: [0, 1, 0] }
        ];

        configs.forEach((cfg) => {
            const container = cfg.canvas.parentElement;
            const aspect = this.getAspect(container);
            const size = window.AppConfig.ORTHOGRAPHIC.SIZE;

            this.scenes[cfg.key] = new this.THREE.Scene();
            this.scenes[cfg.key].background = new this.THREE.Color(0xffffff);
            this.cameras[cfg.key] = new this.THREE.OrthographicCamera(
                -size * aspect,
                size * aspect,
                size,
                -size,
                0.1,
                100
            );
            this.cameras[cfg.key].position.set(...cfg.position);
            this.cameras[cfg.key].up.set(...cfg.up);
            this.cameras[cfg.key].lookAt(0, 0, 0);
            this.renderers[cfg.key] = this.createRenderer(cfg.canvas, container);
        });
    }

    createRenderer(canvas, container) {
        const renderer = new this.THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        return renderer;
    }

    getAspect(container) {
        return container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
    }

    markNeedsRender() {
        if (this.needsRender) return;
        this.needsRender = true;
        requestAnimationFrame(this.boundRender);
    }

    render() {
        if (!this.needsRender || !this.renderer3D || !this.scene3D || !this.camera3D) return;

        if (this.controls && this.controls.enabled) {
            this.controls.update();
        }

        this.renderer3D.render(this.scene3D, this.camera3D);
        Object.keys(this.renderers).forEach((key) => {
            if (this.renderers[key] && this.scenes[key] && this.cameras[key]) {
                this.renderers[key].render(this.scenes[key], this.cameras[key]);
            }
        });

        this.needsRender = false;
    }

    async render3D(modelUrl) {
        const requestId = ++this.loadRequestId;
        this.clearCurrentModel();
        this.resetMainCamera();

        const loadedModel = await this.loadModelOrFallback(modelUrl);
        if (requestId !== this.loadRequestId) {
            this.disposeObject(loadedModel);
            return;
        }

        this.currentModel = loadedModel;
        this.currentModel.name = 'model';
        this.scene3D.add(this.currentModel);
        this.prepareMainModel(this.currentModel);
        const dimensions = this.centerModel(this.currentModel);
        this.renderOrthogonalViews(this.currentModel, dimensions.maxDim);
        this.applyFadeIn();
        this.markNeedsRender();
    }

    async loadModelOrFallback(modelUrl) {
        if (!modelUrl) return this.createFallbackModel();

        try {
            return await this.loadModel(modelUrl);
        } catch (error) {
            const sanitizedError = String(error.message || error).replace(/[\r\n]/g, ' ');
            console.error('Error cargando modelo:', sanitizedError);
            return this.createFallbackModel();
        }
    }

    loadModel(modelUrl) {
        const extension = modelUrl.split('.').pop().toLowerCase();
        if (extension === 'glb' || extension === 'gltf') return this.loadGltfModel(modelUrl);
        if (extension === 'stl') return this.loadStlModel(modelUrl);
        return Promise.reject(new Error(`Formato no soportado: ${extension}`));
    }

    loadGltfModel(modelUrl) {
        if (!this.gltfLoader) return Promise.reject(new Error('GLTFLoader no disponible'));

        return new Promise((resolve, reject) => {
            this.gltfLoader.load(modelUrl, (gltf) => resolve(gltf.scene), undefined, reject);
        });
    }

    loadStlModel(modelUrl) {
        if (!this.stlLoader) return Promise.reject(new Error('STLLoader no disponible'));

        return new Promise((resolve, reject) => {
            this.stlLoader.load(modelUrl, (geometry) => {
                geometry.computeVertexNormals();
                const material = new this.THREE.MeshStandardMaterial({
                    color: 0x4CAF50,
                    roughness: 0.8,
                    metalness: 0
                });
                resolve(new this.THREE.Mesh(geometry, material));
            }, undefined, reject);
        });
    }

    createFallbackModel() {
        const geometry = new this.THREE.BoxGeometry(2, 3, 1);
        const material = new this.THREE.MeshBasicMaterial({ color: 0x4CAF50 });
        return new this.THREE.Mesh(geometry, material);
    }

    prepareMainModel(model) {
        const processedMaterials = new Set();
        const materialConfig = window.AppConfig.MATERIAL;

        model.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = true;
            child.receiveShadow = true;

            this.forEachMaterial(child.material, (material) => {
                if (!material || processedMaterials.has(material.uuid)) return;
                processedMaterials.add(material.uuid);

                if (material.color) {
                    const color = material.color;
                    if (
                        color.r < materialConfig.DARK_THRESHOLD &&
                        color.g < materialConfig.DARK_THRESHOLD &&
                        color.b < materialConfig.DARK_THRESHOLD
                    ) {
                        color.multiplyScalar(materialConfig.BRIGHTNESS_MULTIPLIER);
                    }
                }

                if (material.type === 'MeshStandardMaterial') {
                    material.roughness = 0.8;
                    material.metalness = 0.0;
                    material.needsUpdate = true;
                }
            });
        });
    }

    centerModel(model) {
        this.sharedBox.setFromObject(model);
        const center = this.sharedBox.getCenter(this.sharedCenter);
        const size = this.sharedBox.getSize(this.sharedSize);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        model.position.sub(center);
        this.camera3D.position.setLength(maxDim * 3);
        this.camera3D.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }

        return { center: center.clone(), size: size.clone(), maxDim };
    }

    renderOrthogonalViews(sourceModel, maxDim) {
        this.clearOrthogonalModels();

        Object.keys(this.scenes).forEach((key) => {
            const clone = this.createTechnicalProjectionModel(sourceModel);
            clone.position.copy(sourceModel.position);
            this.scenes[key].add(clone);
        });

        const cameraPadding = window.AppConfig.TECHNICAL_DRAWING.CAMERA_PADDING_FACTOR || 1;
        this.adjustOrthographicCameras(maxDim * cameraPadding);
    }

    createTechnicalProjectionModel(sourceModel) {
        const config = window.AppConfig.TECHNICAL_DRAWING;
        const thresholdAngle = config.EDGE_THRESHOLD_ANGLE ?? 12;

        if (!this.technicalMaterial) {
            this.technicalMaterial = new this.THREE.MeshBasicMaterial({
                color: config.FACE_COLOR ?? 0xffffff,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
        }

        if (!this.technicalLineMaterial) {
            this.technicalLineMaterial = new this.THREE.LineBasicMaterial({
                color: config.EDGE_COLOR ?? 0x111111,
                linewidth: config.EDGE_LINE_WIDTH || 1
            });
        }

        const projectionModel = sourceModel.clone(true);
        projectionModel.name = 'model';
        projectionModel.userData.isTechnicalProjection = true;

        projectionModel.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;

            child.geometry = child.geometry.clone();
            child.material = this.technicalMaterial.clone();
            child.castShadow = false;
            child.receiveShadow = false;

            const edgeGeometry = new this.THREE.EdgesGeometry(child.geometry, thresholdAngle);
            const edges = new this.THREE.LineSegments(edgeGeometry, this.technicalLineMaterial.clone());
            edges.name = 'technical-edges';
            edges.userData.isGeneratedEdgeOverlay = true;
            child.add(edges);
        });

        return projectionModel;
    }

    adjustOrthographicCameras(maxDim) {
        const margin = Math.max(maxDim, 1) * window.AppConfig.ORTHOGRAPHIC.MARGIN_FACTOR;

        Object.keys(this.cameras).forEach((key) => {
            const camera = this.cameras[key];
            const canvas = this.canvasMap[key];
            if (!camera || !canvas) return;

            const aspect = this.getAspect(canvas.parentElement);
            camera.left = -margin * aspect;
            camera.right = margin * aspect;
            camera.top = margin;
            camera.bottom = -margin;
            camera.updateProjectionMatrix();
        });
    }

    resetMainCamera() {
        if (!this.camera3D || !this.controls) return;
        const [x, y, z] = window.AppConfig.SCENE_3D.MAIN_LIGHT_POS;
        this.camera3D.position.set(x, y, z);
        this.camera3D.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    clearCurrentModel() {
        if (!this.currentModel) return;
        this.scene3D.remove(this.currentModel);
        this.disposeObject(this.currentModel);
        this.currentModel = null;
    }

    clearOrthogonalModels() {
        Object.values(this.scenes).forEach((scene) => {
            if (!scene) return;
            for (let i = scene.children.length - 1; i >= 0; i--) {
                const obj = scene.children[i];
                if (obj.name === 'model') {
                    scene.remove(obj);
                    this.disposeObject(obj);
                }
            }
        });
    }

    disposeObject(object) {
        if (!object) return;

        object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            this.forEachMaterial(child.material, (material) => this.disposeMaterial(material));
        });
    }

    disposeMaterial(material) {
        if (!material) return;

        [
            'map',
            'lightMap',
            'aoMap',
            'emissiveMap',
            'bumpMap',
            'normalMap',
            'displacementMap',
            'roughnessMap',
            'metalnessMap',
            'alphaMap',
            'envMap'
        ].forEach((mapName) => {
            if (material[mapName]) material[mapName].dispose();
        });

        material.dispose();
    }

    forEachMaterial(materialOrMaterials, callback) {
        if (Array.isArray(materialOrMaterials)) {
            materialOrMaterials.forEach(callback);
        } else if (materialOrMaterials) {
            callback(materialOrMaterials);
        }
    }

    handleResize() {
        if (!this.renderer3D || !this.camera3D) return;

        const mainContainer = this.canvas3d.parentElement;
        this.renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer3D.setSize(mainContainer.clientWidth, mainContainer.clientHeight, false);
        this.camera3D.aspect = this.getAspect(mainContainer);
        this.camera3D.updateProjectionMatrix();

        Object.keys(this.renderers).forEach((key) => {
            const canvas = this.canvasMap[key];
            const renderer = this.renderers[key];
            if (!canvas || !renderer) return;
            const container = canvas.parentElement;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(container.clientWidth, container.clientHeight, false);
        });

        if (this.currentModel) {
            this.sharedBox.setFromObject(this.currentModel);
            const size = this.sharedBox.getSize(this.sharedSize);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            this.adjustOrthographicCameras(maxDim * window.AppConfig.TECHNICAL_DRAWING.CAMERA_PADDING_FACTOR);
        }

        this.markNeedsRender();
    }

    applyFadeIn() {
        if (!this.canvas3d) return;

        this.canvas3d.classList.remove('fade-in');
        requestAnimationFrame(() => {
            this.canvas3d.classList.add('fade-in');
        });
    }

    cleanup() {
        window.removeEventListener('resize', this.boundResize);
        this.clearCurrentModel();
        this.clearOrthogonalModels();

        if (this.controls) this.controls.dispose();
        if (this.renderer3D) this.renderer3D.dispose();
        Object.values(this.renderers).forEach((renderer) => {
            if (renderer) renderer.dispose();
        });
        if (this.technicalMaterial) this.technicalMaterial.dispose();
        if (this.technicalLineMaterial) this.technicalLineMaterial.dispose();
    }
};
