define([], function() {

    var classes = [];
    for (var i = 0; i < document.styleSheets.length; ++i) {
        for(var j=0; j< document.styleSheets[i].cssRules.length; j++) {
            classes.push(document.styleSheets[i].cssRules[j]);
        }
    }

    function rgbToThreeColor(rgb) {
        var result = /rgb\(([0-9]+),\s*([0-9]+),\s*([0-9]+)\)/.exec(rgb);
        var color = new THREE.Color();
        color.r = parseInt(result[1])/255;
        color.g = parseInt(result[2])/255;
        color.b = parseInt(result[3])/255;
        return color;
    }

    function getColor(selector) {
        for (var x = classes.length - 1; x >= 0; x--) {
            if (classes[x].selectorText === selector) {
                return rgbToThreeColor(classes[x].style.color);
            }
        }
        throw Error('color ' + selector + ' not in stylesheet(s)');
    }

    return {
        workplane: {
            majorGridLine: getColor('.scene .workplane .majorGridLine'),
            minorGridLine: getColor('.scene .workplane .minorGridLine'),
        },
        geometry: {
            selected: getColor('.scene .geometry .selected'),
            selectedAmbient: getColor('.scene .geometry .selectedAmbient'),
            highlightColor: getColor('.scene .geometry .highlightColor'),
            highlightAmbient: getColor('.scene .geometry .highlightAmbient'),
            default: getColor('.scene .geometry .default'),
            defaultAmbient: getColor('.scene .geometry .defaultAmbient'),
            editing: getColor('.scene .geometry .editing'),
        }
    }

});