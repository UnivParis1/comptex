<template> 
<transition name="modal">
 <div class="modal modal-mask" style="display: block" @click="$emit('cancel')">
  <div class="modal-dialog" role="document" @click.stop="">
    <div class="modal-content panel-warning">
      <div class="modal-header panel-heading">
        <slot name="header"></slot>
      </div>
      
      <div class="modal-body">
        <slot name="body"></slot>
      </div>
      
      <div class="modal-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</div>
</transition> 
</template>

<style>
.modal-mask {
 position: fixed;
 z-index: 9998;
 top: 0;
 left: 0;
 width: 100%;
 height: 100%;
 background-color: rgba(0, 0, 0, .5);
 display: table;
 transition: opacity .3s ease;
}
.modal-content {
    max-height: 90vh;
    overflow-y: auto;
}
</style>