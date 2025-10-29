<template>
    <div style="display: inline-block; position: relative;">
      <div style="height: 0">
        <video ref="video" style="background: white; margin: 0 auto; display: block;" autoplay></video>
      </div>
      <div :style="{ width: width + 'px', height: height + 'px' }" style="position: relative; margin: 0 auto; box-sizing: border-box; border: 2px dashed black;"></div>
    </div>
</template>

<script lang="ts">
import { onMounted, useTemplateRef } from "vue";

function toCanvas(video_elt) {
    let canvas = document.createElement("canvas");
    canvas.width = video_elt.clientWidth;
    canvas.height = video_elt.clientHeight;
    canvas.getContext("2d").drawImage(video_elt, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function may_crop_portrait(canvas: HTMLCanvasElement, { width, height }: { width: number, height: number }) {
    let real_width = width * (canvas.height / height);
    let width_offset = (canvas.width - real_width) / 2;
    if (width_offset <= 0) return canvas;
    
    let c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.getContext("2d").drawImage(canvas, width_offset, 0, real_width, canvas.height, 0, 0, width, height);
    return c;
}

</script>
<script setup lang="ts">

const props = defineProps<{
    width: number,
    height: number,
}>()

const emit = defineEmits<{
    'error': [err: any],
}>();


const video = useTemplateRef('video')
onMounted(async () => {
        let elt = video.value;
        
        if (props.height) elt.height = props.height;
        
        try {
            elt.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err) {
            console.error(err);
            emit('error', err);
        }
})

const get = () => (
    may_crop_portrait(toCanvas(video.value), props).toDataURL('image/jpeg')
)

defineExpose({ get })
</script>
