
describe('controller various', function() {

  beforeEach(angular.mock.module('myApp'));

  describe('create controller', function(){

    it('should create EmptyCtrl', angular.mock.inject(function($controller : ng.IControllerService) {
      var ctrl = $controller('EmptyCtrl');
      expect(ctrl).toBeDefined();
    }));

  });
});
