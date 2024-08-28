define([
    'Titan',
    './MapPresenter'
], function (Titan, MapPresenter) {
    return Titan.Place.extend({
        name: 'Map Place',
        pattern: 'map',
        Presenter: MapPresenter,
        fn: 'home',
        defaultPlace: true
    });
});