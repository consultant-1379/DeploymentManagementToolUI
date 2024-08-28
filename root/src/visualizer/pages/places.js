define([
    'Titan',
    './map/MapPlace',
    './filter/FilterPlace'
], function (Titan) {
    return Titan.utils.getListFromArguments(arguments, 1);
 });