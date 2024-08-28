define([
    'Titan',
    './FilterPresenter'
], function (Titan, FilterPresenter) {
    return Titan.Place.extend({
        name: 'Filter Place',
        pattern: 'filter',
        Presenter: FilterPresenter,
        fn: 'init'
    });
});