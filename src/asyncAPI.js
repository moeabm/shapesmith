define([
        'underscore',
        'geomnode',
        'casgraph/sha1hasher',
        'geometrygraphsingleton',
        'command',
        'commandstack',
    ], function(
        _,
        GeomNode,
        hasher,
        geometryGraph,
        Command,
        commandStack) {

    var layerTree = geometryGraph.layerTree;

    var commit = function(vertices) {

        var doFn = function(commandSuccessFn, commandErrorFn) {
            var graphSHA = geometryGraph.capture();
            return commandSuccessFn(graphSHA);
        }

        var undoFn = function() {
            geometryGraph.undo();
        }

        var redoFn = function() {
            geometryGraph.redo();
        }

        var command = new Command(doFn, undoFn, redoFn);
        return commandStack.do(command, vertices);
    }

    var tryCommitAdd = function(vertices) {
        var allOk = true;
        vertices.forEach(function(v) {
            if (!geometryGraph.validate(v)) {
                allOk = false;
            }
        });
        if (!allOk) {
            return {'error' : 'validation'};
        }
        vertices.forEach(function(v) {
            geometryGraph.add(v);
        });

        return commit(vertices);
    }

    var tryCommitCreate = function(editingVertices) {
        var allOk = true;
        editingVertices.forEach(function(v) {
            if (!geometryGraph.validate(v)) {
                allOk = false;
            }
        });
        if (!allOk) {
            return {'error' : 'validation'};
        }

        var nonEditingVertices = editingVertices.map(function(v) {
            var nonEditing = v.cloneNonEditing();
            geometryGraph.replace(v, nonEditing);
            return nonEditing;
        });

        return commit(nonEditingVertices);
    }


    var tryCommitEdit = function(originalVertices, editingVertices) {
        var allOk = true;
        editingVertices.forEach(function(v) {
            if (!geometryGraph.validate(v)) {
                allOk = false;
            }
        });
        if (!allOk) {
            return {'error' : 'validation'};
        }

        var allSame = true;
        for (var i = 0; i < editingVertices.length; ++i) {
            if (hasher.hash(GeomNode.strip(originalVertices[i])) 
                !== 
                hasher.hash(GeomNode.strip(editingVertices[i]))) {

                allSame = false;
                break
            }
        }
        if (allSame) {
            editingVertices.forEach(function(v, i) {
                geometryGraph.replace(v, originalVertices[i]);
            });
            return {newVertices: originalVertices};
        } else {
            var nonEditingVertices = editingVertices.map(function(v) {
                var nonEditing = v.cloneNonEditing();
                geometryGraph.replace(v, nonEditing);
                return nonEditing;
            });
            return commit(nonEditingVertices);
        }

    }


    var tryCommitReplace = function(originalVertices, editingVertices) {
        var allOk = true;
        editingVertices.forEach(function(v) {
            if (!geometryGraph.validate(v)) {
                allOk = false;
            }
        });
        if (!allOk) {
            return {'error' : 'validation'};
        }

        var nonEditingVertices = editingVertices.map(function(v) {
            var nonEditing = v.cloneNonEditing();
            geometryGraph.replace(v, nonEditing);
            return nonEditing;
        });
        return commit(nonEditingVertices);
    }

    var tryCommitDelete = function(vertex) {

        var children = _.uniq(geometryGraph.childrenOf(vertex));
        var parents =  geometryGraph.parentsOf(vertex);

        if (parents.length > 0) {
            return {error: 'cannot delete vertex with parents'};
        }

        var toRemove = [];
        var collectVerticesToRemove = function(parent) {
            toRemove.push(parent);
            geometryGraph.childrenOf(parent).forEach(function(child) {

                // Avoid removing shared children more than once
                if (toRemove.indexOf(child) === -1) {
                    // Delete children that have only this parent
                    var parents = geometryGraph.parentsOf(child);
                    var hasOtherParent = _.find(parents, function(p) {
                        return p.id !== parent.id;
                    });
                    if (!hasOtherParent) {
                        collectVerticesToRemove(child);
                    }
                }
            }); 
        }
        collectVerticesToRemove(vertex);
        toRemove.forEach(function(v) {
            geometryGraph.remove(v);
        });

        return commit([]);

    }

    var commitLayerTree = function(oldlayerTreeObj, newlayerTreeObj) {
        geometryGraph.setMetadata(newlayerTreeObj); 
        layerTree.trigger('change');
        return commit([]);
    }

    var cancelCreate = function(vertex) {
        geometryGraph.remove(vertex);
    }

    var cancelEdit = function(editingVertices, originalVertices) {
        editingVertices.forEach(function(editingVertex, i) {
            geometryGraph.replace(editingVertex, originalVertices[i]);
        });
    }

    var edit = function(vertex) {
        var editingReplacement = vertex.cloneEditing();
        geometryGraph.replace(vertex, editingReplacement);
        return editingReplacement;
    }

    var loadFromCommit = function(replicator, graphHash, callback) {
        GeomNode.resetIDCounters();
        geometryGraph.removeAll();
        replicator.readGraph(graphHash, function(success, errMsg) {
            loadFinished();
            callback && callback();
        })
    }

    var loadFinished = function() {


        geometryGraph.notifyAdded(function(v) {
            return true;
        });

        var defaults = {
            'workplane'       : GeomNode.Workplane,
        }
        _.map(defaults, function(ctor, type) {
            var hasOne = geometryGraph.verticesByType(type).length > 0;
            if (!hasOne) {
                geometryGraph.add(new ctor());
            }
        });

        geometryGraph.capture();

        var graphMetadata = geometryGraph.getMetadata();
        if (graphMetadata) {
            layerTree.fromObj(graphMetadata);
            layerTree.trigger('change');
        }
        
        // This is for webdriver to determine when things have loaded
        if (!SS.loadDone) {
            SS.loadDone = true;
        }
    }

    return {
        edit             : edit,
        commit           : commit,
        tryCommitEdit    : tryCommitEdit,
        tryCommitReplace : tryCommitReplace,
        tryCommitAdd     : tryCommitAdd,
        tryCommitCreate  : tryCommitCreate,
        tryCommitDelete  : tryCommitDelete,
        commitLayerTree : commitLayerTree,
        cancelEdit       : cancelEdit,
        cancelCreate     : cancelCreate,
        loadFromCommit   : loadFromCommit,
    }

});