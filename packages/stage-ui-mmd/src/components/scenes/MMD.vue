<script setup lang="ts">
import type { DirectionalLight } from 'three'

import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { Screen } from '@proj-airi/ui'
import { TresCanvas } from '@tresjs/core'
import { storeToRefs } from 'pinia'
import { ACESFilmicToneMapping, Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { ref, shallowRef, watch } from 'vue'

import MMDModel from './mmd/Model.vue'

const props = withDefaults(defineProps<{
  modelSrc?: string
  paused?: boolean
  currentAudioSource?: AudioBufferSourceNode
  textureMap?: Map<string, string>
  scale?: number
  positionX?: number
  positionY?: number
  previewExpression?: string
  idleAnimations?: string[]
}>(), {
  paused: false,
  scale: 1,
  positionX: 0,
  positionY: 0,
})

const emit = defineEmits<{
  (e: 'error', value: unknown): void
  (e: 'scaleChange', value: number): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const camera = shallowRef(new PerspectiveCamera())
const mmdStore = useMmd()
const {
  currentMotion,
  directionalLightPosition,
  directionalLightTarget,
  directionalLightRotation,
  directionalLightIntensity,
  directionalLightColor,

  ambientLightIntensity,
  ambientLightColor,

  hemisphereSkyColor,
  hemisphereGroundColor,
  hemisphereLightIntensity,

  envSelect,
} = storeToRefs(mmdStore)

const dirLightRef = ref<InstanceType<typeof DirectionalLight>>()

function updateDirLightTarget(newRotation: { x: number, y: number, z: number }) {
  const light = dirLightRef.value
  if (!light)
    return

  const { x: rx, y: ry, z: rz } = newRotation
  const lightPosition = new Vector3(
    directionalLightPosition.value.x,
    directionalLightPosition.value.y,
    directionalLightPosition.value.z,
  )
  const origin = new Vector3(0, 0, 0)
  const euler = new Euler(
    MathUtils.degToRad(rx),
    MathUtils.degToRad(ry),
    MathUtils.degToRad(rz),
    'XYZ',
  )
  const initialForward = origin.clone().sub(lightPosition).normalize()
  const newForward = initialForward.applyEuler(euler).normalize()
  const distance = lightPosition.distanceTo(origin)
  const target = lightPosition.clone().addScaledVector(newForward, distance)

  light.target.position.copy(target)
  light.target.updateMatrixWorld()

  directionalLightTarget.value = { x: target.x, y: target.y, z: target.z }
}

watch(directionalLightRotation, (newRotation) => {
  updateDirLightTarget(newRotation)
}, { deep: true })

watch([dirLightRef], ([dirLight]) => {
  if (!dirLight)
    return
  try {
    dirLight.parent?.add(dirLight.target)
    dirLight.target.position.set(
      directionalLightTarget.value.x,
      directionalLightTarget.value.y,
      directionalLightTarget.value.z,
    )
    dirLight.target.updateMatrixWorld()
  }
  catch (error) {
    console.error('[MMD] Failed to setup directional light target:', error)
  }
})

function onTresReady() {
  componentState.value = 'mounted'
}

function onSceneBootstrap(data: any) {
  if (camera.value) {
    camera.value.position.set(data.cameraPosition.x, data.cameraPosition.y, data.cameraPosition.z)
    camera.value.lookAt(data.lookAtTarget.x, data.lookAtTarget.y, data.lookAtTarget.z)
  }
}

function handleWheel(event: WheelEvent) {
  const delta = event.deltaY * -0.0005
  const newScale = Math.min(Math.max((props.scale || 1) + delta, 0.1), 3)
  emit('scaleChange', newScale)
}
</script>

<template>
  <Screen v-slot="{ width, height }" relative>
    <div class="h-full w-full" @wheel="handleWheel">
      <TresCanvas
        :camera="(camera as any)"
        :alpha="true"
        :antialias="true"
        :width="width"
        :height="height"
        :tone-mapping="ACESFilmicToneMapping"
        :tone-mapping-exposure="1"
        :clear-alpha="0"
        power-preference="high-performance"
        @ready="onTresReady"
      >
        <TresHemisphereLight
          v-if="envSelect === 'hemisphere'"
          :color="hemisphereSkyColor"
          :ground-color="hemisphereGroundColor"
          :position="[0, 1, 0]"
          :intensity="hemisphereLightIntensity"
          cast-shadow
        />
        <TresAmbientLight
          :color="ambientLightColor"
          :intensity="ambientLightIntensity"
          cast-shadow
        />
        <TresDirectionalLight
          ref="dirLightRef"
          :color="directionalLightColor"
          :position="[directionalLightPosition.x, directionalLightPosition.y, directionalLightPosition.z]"
          :intensity="directionalLightIntensity"
          cast-shadow
        />

        <MMDModel
          :model-src="modelSrc"
          :paused="paused"
          :current-audio-source="currentAudioSource"
          :texture-map="textureMap"
          :model-offset="{ x: props.positionX, y: props.positionY, z: 0 }"
          :model-rotation-y="0"
          :look-at-target="{ x: 0, y: 0, z: -100 }"
          tracking-mode="orbit"
          :eye-height="1.5"
          :camera-position="{ x: 0, y: 1.5, z: 5 }"
          :camera="camera"
          :scale="props.scale"
          :preview-expression="props.previewExpression"
          :idle-animations="props.idleAnimations"
          :idle-animation="`/assets/mmd/animations/${currentMotion}`"
          @scene-bootstrap="onSceneBootstrap"
          @error="(err) => emit('error', err)"
        />
      </TresCanvas>
    </div>
  </Screen>
</template>
