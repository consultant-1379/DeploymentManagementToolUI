define([
    'Titan',
    'template!./Map.html',
    'styles!./Map.less'
], function (Titan, template, style) {
    return Titan.View.extend({
        template: template,
        styles: style
    });
});