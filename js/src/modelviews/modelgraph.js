// The model graph is a collection of Backbone models for the vertices
// in the graph. Each vertex in the graph has one Backbone model. Each model 
// can potentially have more than one view, but typically there is one scene
// view and one or more dom tree views for each node (in the case of shared 
// vertices)
define([
        'underscore',
        'backbone-events',
        'src/geometrygraphsingleton',
        'src/modelviews/vertexMV', 
        'src/modelviews/pointMV', 
        'src/modelviews/polylineMV',
        'src/modelviews/cubeMV',
        'src/modelviews/sphereMV',
        'src/modelviews/subtractMV',
    ], 
    function(
        _,
        Events,
        geometryGraph,
        VertexMV,
        PointMV, 
        PolylineMV,
        CubeMV,
        SphereMV,
        SubtractMV) {

    var wrappers = {
        'point'     : PointMV,
        'polyline'  : PolylineMV,
        'cube'      : CubeMV,
        'sphere'    : SphereMV,
        'subtract'  : SubtractMV,
    }

    var Models = function() {

        _.extend(this, Events);

        var that = this;
        var models = {};

        geometryGraph.on('vertexAdded', function(vertex) {
            if (vertex.category === 'geometry') {

                var modelConstructor = vertex.editing ? 
                    wrappers[vertex.type].EditingModel :
                    wrappers[vertex.type].DisplayModel;
                var model = new modelConstructor({
                    vertex: vertex,
                });
                model.addSceneView();
                models[vertex.id] = model;

                that.trigger('added', vertex, model);
            }
        });

        geometryGraph.on('vertexRemoved', function(vertex) {
            if (vertex.category === 'geometry') {

                if (!models[vertex.id]) {
                    throw Error('no model for ' + vertex.id);
                }
                var model = models[vertex.id];
                model.destroy();
                delete models[vertex.id];

                that.trigger('removed', vertex, model);
            }
        });

        geometryGraph.on('vertexReplaced', function(original, replacement) {
            if (replacement.category === 'geometry') {

                if (!models[original.id]) {
                    throw Error('no model for ' + original.id);
                }

                var originalModel = models[original.id];
                var modelConstructor = replacement.editing ? 
                    wrappers[replacement.type].EditingModel :
                    wrappers[replacement.type].DisplayModel;
                var replacementModel = new modelConstructor({
                    original: original, 
                    vertex: replacement,
                });

                replacementModel.addSceneView();

                if (originalModel.sceneView.showStack) {
                    for (var i = 0; i < originalModel.sceneView.showStack; ++i) {
                        replacementModel.sceneView.pushShowStack();
                    }
                }

                models[replacement.id] = replacementModel;
                that.trigger('replaced', original, originalModel, replacement, replacementModel);

                // Destroy after replacement for DOM replacement
                originalModel.destroy();
            }
        }); 

        this.get = function(vertex) {
            return models[vertex.id];
        }

        this.cancelIfEditing = function() {
            _.map(models, function(model) {
                if (model.vertex.editing) {
                    model.cancel();
                }
            });
        }
    }

    return new Models();

});