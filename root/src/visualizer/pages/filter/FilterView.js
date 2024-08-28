define([
    'Titan',
    'template!./filter.html',
    'styles!./filter.css'
], function (Titan, template, style) {
    return Titan.View.extend({
        template: template,
        styles: style
    });
});