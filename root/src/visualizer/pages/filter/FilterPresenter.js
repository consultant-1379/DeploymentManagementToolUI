define([
    'Titan',
    './FilterView'
], function (Titan, View) {
    return Titan.Presenter.extend({
        View: View,
        init: function () {
            console.log("Init Proto");

        }
    });
});