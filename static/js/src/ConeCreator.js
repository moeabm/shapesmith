var SS = SS || {};

SS.ConeCreator = SS.Creator.extend({

    initialize: function(attributes) {
        SS.Creator.prototype.initialize.call(this, attributes);

        this.node.parameters.r1 = 10;
        this.node.parameters.r2 = 0;
        this.node.parameters.h = 10;
        this.node.extra = {angle: 0};

        this.views = this.views.concat([
            new SS.ConePreview({model: this}),
            new SS.DraggableRadiusCorner({model: this, key: 'r1'}),
        ]);
        this.trigger('change', this);
    },

    mouseDownOnRadius: function(corner) {
        this.activateCorner(corner, SS.RadiusHeightCursoid, {model: this, key: 'r1'});
    },

    getBoundingBox: function() {
        var origin = this.node.origin;
        var r1 = this.node.parameters.r1;
        var h = this.node.parameters.h;
        return {min: new THREE.Vector3(origin.x - r1, origin.y - r1, origin.z),
                max: new THREE.Vector3(origin.x + r1, origin.y + r1, origin.z + h)};
    },


});

SS.ConePreview = SS.PreviewWithOrigin.extend({

    initialize: function() {
        SS.PreviewWithOrigin.prototype.initialize.call(this);
        this.render();
    },
    
    render: function() {
        this.clear();
        SS.PreviewWithOrigin.prototype.render.call(this);

        var origin = this.model.node.origin;
        var r1 = this.model.node.parameters.r1;
        var r2 = this.model.node.parameters.r2;
        var h = this.model.node.parameters.h;

        if (r1 && h) {
            var geometry = new THREE.CylinderGeometry(r1, r2 || 0.000001, h, 20);
	    var cone = new THREE.Mesh(geometry, SS.constructors.faceMaterial);
	    cone.position = new THREE.Vector3(origin.x, origin.y, origin.z + h/2);
            cone.rotation.x = -Math.PI/2;
	    this.sceneObject.add(cone);
	    
	    var circleGeom2 = new THREE.Geometry();
	    for(var i = 0; i <= 50; ++i) {
		var theta = Math.PI*2*i/50;
		var dx = r2*Math.cos(theta);
		var dy = r2*Math.sin(theta);
		circleGeom2.vertices.push(new THREE.Vertex(new THREE.Vector3(dx, dy, 0)));
	    }
	    var circle2 = new THREE.Line(circleGeom2, SS.constructors.lineMaterial);
            circle2.position = new THREE.Vector3(origin.x, origin.y, origin.z + h);
	    this.sceneObject.add(circle2);

	}

        if (r1) {
	    var circleGeom1 = new THREE.Geometry();
	    for(var i = 0; i <= 50; ++i) {
		var theta = Math.PI*2*i/50;
		var dx = r1*Math.cos(theta);
		var dy = r1*Math.sin(theta);
		circleGeom1.vertices.push(new THREE.Vertex(new THREE.Vector3(dx, dy, 0)));
	    }
	    var circle1 = new THREE.Line(circleGeom1, SS.constructors.lineMaterial);
            circle1.position = new THREE.Vector3(origin.x, origin.y, origin.z);
	    this.sceneObject.add(circle1);
        }
        
       
        this.postRender();
    },

});


