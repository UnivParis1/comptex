'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', [
  'ngMessages',
  'ngRoute',
  'ui.bootstrap',
]).
service("conf", function($window) {
    angular.extend(this, $window.conf);
}).
config(['$locationProvider', function($locationProvider) {
    // use the HTML5 History API
    $locationProvider.html5Mode(true);
}]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/'});
}]);
