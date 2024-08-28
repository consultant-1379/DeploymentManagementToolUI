define([
    'Titan',
    './pages/places'
], function (Titan, places) {
    return Titan.Application.extend({
        places:places,
        namespace: "visualizer"
    });
});