define([
        'jquery',
        'lib/jquery.mustache',
        'src/calculations', 
        'src/colors',
        'src/scene', 
        'src/interactioncoordinator',
        'src/scenevieweventgenerator',
        'src/worldcursor',
        'src/geometrygraphsingleton',
        'src/modelviews/geomvertexMV', 
        'src/modelviews/dimensionview',
        'src/asyncAPI',
    ], 
    function(
        $, __$,
        calc, 
        colors, 
        sceneModel, 
        coordinator,
        sceneViewEventGenerator,
        worldCursor,
        geometryGraph,
        GeomVertexMV,
        DimensionView,
        AsyncAPI) {

    // ---------- Editing ----------

    var EditingModel = GeomVertexMV.EditingModel.extend({

        initialize: function(options) {
            this.displayModelConstructor = DisplayModel;
            GeomVertexMV.EditingModel.prototype.initialize.call(this, options);
            this.setMainSceneView(new EditingSceneView({model: this}));
            this.views.push(new CoordinateDOMView({model: this}));
        },

        addTreeView: function() {
            var domView = new EditingDOMView({model: this});
            this.views.push(domView);
            return domView;
        },

        workplanePositionChanged: function(position) {
            if (this.vertex.implicit) {
                // handled by parent model
                return
            }
            if (this.vertex.proto) {
                this.hintView.set('Click to add a point.');
                this.vertex.parameters.coordinate.x = position.x;
                this.vertex.parameters.coordinate.y = position.y;
                this.vertex.parameters.coordinate.z = position.z;
                this.vertex.trigger('change', this.vertex);            
            }
        },

        // Sceneview click can be on any scene view, not just this one
        // I.e. clicks not on this point are creation clicks
        sceneViewClick: function(viewAndEvent) {
            if (this.vertex.proto && (viewAndEvent.view !== this)) {
                this.workplaneClick();
            }
        },

        workplaneClick: function() {
            if (this.vertex.implicit) {
                // handled by parent
                return
            }
            this.tryCommit()
        },

    });

    var EditingDOMView = GeomVertexMV.EditingDOMView.extend({

        render: function() {
            GeomVertexMV.EditingDOMView.prototype.render.call(this);
            var template = 
                this.beforeTemplate +
                '<div class="coordinate">' +
                '<input class="field x" type="text" value="{{x}}"></input>' +
                '<input class="field y" type="text" value="{{y}}"></input>' +
                '<input class="field z" type="text" value="{{z}}"></input>' +
                '</div>' +
                this.afterTemplate;
            var view = this.baseView;
            this.$el.html($.mustache(template, view));
            this.update();
            return this;
        },

        update: function() {
            var that = this;
            ['x', 'y', 'z'].forEach(function(key) {
                that.$el.find('.coordinate').find('.' + key).val(
                    that.model.vertex.parameters.coordinate[key]);
            });
        },

        updateFromDOM: function() {
            var that = this;
            ['x', 'y', 'z'].forEach(function(key) {
                try {
                    var expression = that.$el.find('.field.' + key).val();
                    that.model.vertex.parameters.coordinate[key] = expression;
                } catch(e) {
                    console.error(e);
                }
            });
            this.model.vertex.trigger('change', this.model.vertex);
        }
    });
 
    var EditingSceneView = GeomVertexMV.EditingSceneView.extend({

        initialize: function(options) {
            GeomVertexMV.EditingSceneView.prototype.initialize.call(this);
            this.on('dragStarted', this.dragStarted, this);
            this.on('dragEnded', this.dragEnded, this);
            this.on('drag', this.drag, this);
        },

        remove: function() {
            GeomVertexMV.EditingSceneView.prototype.remove.call(this);
            this.off('dragStarted', this.dragStarted, this);
            this.off('dragEnded', this.dragEnded, this);
            this.off('drag', this.drag, this);
        },

        render: function() {
            GeomVertexMV.EditingSceneView.prototype.render.call(this);
            this.point = THREE.SceneUtils.createMultiMaterialObject(
                new THREE.CubeGeometry(1, 1, 1, 1, 1, 1), 
                [
                    this.materials.editing.face, 
                    this.materials.editing.wire
                ]);
            this.point.position = calc.objToVector(this.model.vertex.parameters.coordinate, geometryGraph, THREE.Vector3);
            this.sceneObject.add(this.point);
            this.updateScaledObjects();
        },

        updateScaledObjects: function() {
            this.point.scale = this.cameraScale;
        },

        isClickable: function() { 
            if (this.model.vertex.implicit) {
                return true;
            } else {
                return GeomVertexMV.EditingSceneView.prototype.isClickable(this);
            }
        },

        // This view is not draggable, but the display scene view can transfer 
        // the dragging to this view (e.g. when a point is dragged), but only for
        // points that are not prototypes any more
        isDraggable: function() {
            return !this.model.vertex.proto || (this.model.parentModel && this.model.parentModel.childPointsAreDraggable);
        },

        dragStarted: function() {
            // The drag was started when the point was being edited, as
            // opposed to starting from a display node
            this.dragStartedInEditingMode = true;
        },

        drag: function(position) {
            this.dragging = true;
            this.model.vertex.parameters.coordinate = {
                x: position.x,
                y: position.y,
                z: position.z,
            }
            this.model.vertex.trigger('change', this.model.vertex);
        },

        dragEnded: function() {
            if (!this.dragStartedInEditingMode) {
                this.model.tryCommit();
            }
        },

    });

    var CoordinateDOMView = DimensionView.extend({

        className: 'dimensions coordinate',

        initialize: function() {
            this.render();
            DimensionView.prototype.initialize.call(this);
        },

        render: function() {
            var template = 
                '(<div class="dim x">{{x}}</div>,' +
                '<div class="dim y">{{y}}</div>,' +
                '<div class="dim z">{{z}}</div>)';
            var view = 
                calc.objToVector(this.model.vertex.parameters.coordinate, geometryGraph, THREE.Vector3);
            this.$el.html($.mustache(template, view));
        },

        update: function() {
            this.render();
            var camera = sceneModel.view.camera;
            var sceneWidth = $('#scene').innerWidth();
            var sceneHeight = $('#scene').innerHeight();
            var screenPos = calc.toScreenCoordinates(sceneWidth, sceneHeight, camera, 
                calc.objToVector(this.model.vertex.parameters.coordinate,  geometryGraph, THREE.Vector3));
            this.$el.css('left', (screenPos.x + 10) + 'px');
            this.$el.css('top',  (screenPos.y + 0) + 'px');
        },

    });

    // ---------- Display ----------

    var DisplayModel = GeomVertexMV.DisplayModel.extend({

        initialize: function(options) {
            this.editingModelConstructor = EditingModel;
            this.displayModelConstructor = DisplayModel;
            GeomVertexMV.DisplayModel.prototype.initialize.call(this, options);
        },

        addSceneView: function() {
            this.sceneView = new DisplaySceneView({model: this});
            this.views.push(this.sceneView);
            return this.sceneView;
        },

    });    

    var DisplaySceneView = GeomVertexMV.DisplaySceneView.extend({

        hasPriority: true,

        initialize: function() {
            GeomVertexMV.DisplaySceneView.prototype.initialize.call(this);
            this.on('dragStarted', this.dragStarted, this);
            this.on('mouseenter', this.mouseenter, this);
            this.on('mouseleave', this.mouseleave, this);
        },

        remove: function() {
            GeomVertexMV.DisplaySceneView.prototype.remove.call(this);
            this.off('dragStarted', this.dragStarted, this);
            this.on('mouseenter', this.mouseenter, this);
            this.on('mouseleave', this.mouseleave, this);
        },

        render: function() {
            GeomVertexMV.EditingSceneView.prototype.render.call(this);
            var radius = this.model.vertex.implicit ? 0.4 : 0.5;

            if (this.mouseIsOver) {
                this.point = THREE.SceneUtils.createMultiMaterialObject(
                    new THREE.CubeGeometry(1, 1, 1), [
                        this.materials.editing.face, 
                        this.materials.editing.wire
                    ]);
            } else {
                var materials;
                if (this.model.vertex.implicit && !this.highlighted) {
                    materials = [this.materials.implicit.face];
                } else {
                    materials = [this.materials.normal.face, this.materials.normal.wire];
                }
                this.point = THREE.SceneUtils.createMultiMaterialObject(
                    new THREE.CubeGeometry(1, 1, 1), materials);
            }

            this.point.scale = this.cameraScale;
            this.point.position = calc.objToVector(
                this.model.vertex.parameters.coordinate,
                geometryGraph,
                THREE.Vector3);
            this.sceneObject.add(this.point);
            this.updateScaledObjects();
        },

        mouseenter: function() {
            if (!geometryGraph.isEditing()) {
                this.mouseIsOver = true;
                this.render();
            }
        },

        mouseleave: function() {
            if (!geometryGraph.isEditing()) {
                delete this.mouseIsOver;
                this.render();
            }
        },

        updateScaledObjects: function() {
            this.point.scale = this.cameraScale;

            if (this.selectionPoint) {
                this.hiddenSelectionObject.remove(this.selectionPoint);
            }

            var hiddenGeometry = new THREE.CubeGeometry(2, 2, 2);
            var that = this;
            hiddenGeometry.vertices = hiddenGeometry.vertices.map(function(vertex) {
                vertex.multiply(that.cameraScale);
                vertex.add(that.point.position);
                return vertex;
            });
            hiddenGeometry.computeCentroids();
            hiddenGeometry.computeFaceNormals();
            hiddenGeometry.computeBoundingSphere();
            this.selectionPoint = new THREE.Mesh(
                hiddenGeometry,
                new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.DoubleSide }));
            this.hiddenSelectionObject.add(this.selectionPoint);  
        },

        isDraggable: function() {
            return !geometryGraph.isEditing();
        },

        dragStarted: function() {
            AsyncAPI.edit(this.model.vertex);
            sceneViewEventGenerator.replaceInDraggable(this, this.model.vertex.id);
        },

    });


    // ---------- Module ----------

    return {
        EditingModel: EditingModel,
        DisplayModel: DisplayModel,
    }


});
