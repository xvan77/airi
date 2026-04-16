import type { VRM } from '@pixiv/three-vrm'
import type { Object3D } from 'three'

import { CanvasTexture, Line, Raycaster, Sprite, SpriteMaterial, Vector2, Vector3 } from 'three'
import { ref, shallowRef } from 'vue'

import * as THREE from 'three'

import { useModelStore } from '../../stores/model-store'

/**
 * useVRMClothInteraction
 * R&D Prototype for "Wired-style" tactile cloth interaction.
 * Allows users to "tug" on fabric using mouse drag, with visual tethering.
 */
export function useVRMClothInteraction() {
  const isDragging = ref(false)
  const targetBone = shallowRef<Object3D | null>(null)

  // Cache for performance-heavy lookups
  const nodes = {
    jaw: null as Object3D | null,
    head: null as Object3D | null,
    boundary: new THREE.Box3(), // Persistent hit-aura
    hasBoundary: false,
  }

  // Interaction State
  const modelStore = useModelStore()
  const activePuffs: Sprite[] = []
  const clothMeshCache = shallowRef<Object3D[]>([])
  const fullMeshCache = shallowRef<Object3D[]>([])
  let lastHitMesh: THREE.Mesh | null = null

  // Initialize Tether Line Mesh
  const lineGeom = new THREE.BufferGeometry()
  const tetherPosBuffer = new Float32Array(6) // Reuse this buffer
  lineGeom.setAttribute('position', new THREE.BufferAttribute(tetherPosBuffer, 3))
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.4 })
  const tetherLine = shallowRef<Line>(new Line(lineGeom, lineMat))

  const basePosition = new Vector3()
  const currentTension = ref(0)
  const maxStretch = 0.15 // 15cm max pull

  // Texture Cache
  let puffTexture: THREE.Texture | null = null
  let voidTexture: THREE.Texture | null = null

  function getPuffTexture(isVanish: boolean) {
    if (isVanish && voidTexture)
      return voidTexture
    if (!isVanish && puffTexture)
      return puffTexture

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(32, 32, 28, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    const tex = new CanvasTexture(canvas)
    if (isVanish)
      voidTexture = tex
    else puffTexture = tex
    return tex
  }

  // Interaction Helpers
  const raycaster = new Raycaster()
  const mouse = new Vector2()
  const intersectionPoint = new Vector3()
  const grabPoint = new Vector3() // Local point in vrm.scene where grab started

  function resolveNodes(vrm: VRM) {
    if (!vrm)
      return
    if (!nodes.jaw || !nodes.head) {
      nodes.jaw = vrm.humanoid?.getNormalizedBoneNode('jaw') || null
      nodes.head = vrm.humanoid?.getNormalizedBoneNode('head') || null
    }

    // [SPEED-FIX] Calculate boundary strictly ONCE per model load
    if (!nodes.hasBoundary) {
      nodes.boundary.setFromObject(vrm.scene)
      nodes.hasBoundary = true

      // [PHASE-3] Cache all meshes one-time to avoid 12s traversal lag
      const all: Object3D[] = []
      const cloth: Object3D[] = []
      vrm.scene.traverse((obj) => {
        if ((obj as any).isMesh) {
          all.push(obj)
          const name = obj.name.toLowerCase()
          if (name.includes('cloth') || name.includes('skirt') || name.includes('shirt') || name.includes('sleeve') || name.includes('ribbon') || name.includes('body') || name.includes('dress') || name.includes('acc')) {
            cloth.push(obj)
          }
        }
      })
      fullMeshCache.value = all
      clothMeshCache.value = cloth
      console.log(`[WIRED] Logic Caches Ready. Meshes: ${all.length}, Cloth: ${cloth.length}`)
    }
  }

  function spawnPuff(point: Vector3, scene: THREE.Object3D, isVanish = false) {
    const localPoint = point.clone()
    scene.worldToLocal(localPoint)

    const material = new SpriteMaterial({
      map: getPuffTexture(isVanish),
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    })

    if (isVanish)
      material.color.setHSL(0.8, 0.9, 0.4)
    else material.color.setHSL(Math.random(), 0.8, 0.6)

    const puff = new Sprite(material)
    puff.position.copy(localPoint)
    const size = isVanish ? 0.3 : 0.05
    puff.scale.set(size, size, size)
    scene.add(puff)
    activePuffs.push(puff)
  }

  function startTug(event: { x: number, y: number }, camera: THREE.Camera, vrm: VRM) {
    if (!vrm || modelStore.interactionMode !== 'tactile')
      return

    mouse.x = (event.x / window.innerWidth) * 2 - 1
    mouse.y = -(event.y / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    resolveNodes(vrm)

    if (!raycaster.ray.intersectsBox(nodes.boundary))
      return

    // [SPEED-FIX] Filter only VISIBLE cloth first to avoid 23s 'hidden outfit' tax
    const visibleCloth = clothMeshCache.value.filter(m => m.visible)
    let intersects = raycaster.intersectObjects(visibleCloth, false)

    if (intersects.length === 0) {
      // [SPEED-FIX] Fallback to other VISIBLE meshes (accessories, body, etc)
      const visibleFull = fullMeshCache.value.filter(m => m.visible)
      intersects = raycaster.intersectObjects(visibleFull, false)
    }

    if (intersects.length > 0) {
      const hit = intersects[0]
      intersectionPoint.copy(hit.point)
      lastHitMesh = hit.object as THREE.Mesh // Target Memory for double-click

      // Only proceed with "Tug" logic if it belongs to clothMeshCache
      const isCloth = clothMeshCache.value.includes(hit.object)
      if (isCloth) {
        let nearestBone: Object3D | null = null
        let minDist = Infinity
        vrm.scene.traverse((obj) => {
          if (obj.type === 'Bone') {
            const bonePos = new Vector3()
            obj.getWorldPosition(bonePos)
            const d = bonePos.distanceTo(intersectionPoint)
            if (d < minDist) {
              minDist = d
              nearestBone = obj
            }
          }
        })

        if (nearestBone) {
          if (nodes.hasBoundary)
            nodes.hasBoundary = false
          isDragging.value = true
          targetBone.value = nearestBone as Object3D
          basePosition.copy(targetBone.value.position)
          grabPoint.copy(intersectionPoint)
          vrm.scene.worldToLocal(grabPoint)
          spawnPuff(intersectionPoint, vrm.scene)
        }
      }
    }
    else {
      lastHitMesh = null
    }
  }

  function toggleMesh(event: { x: number, y: number }, camera: THREE.Camera, vrm: VRM) {
    if (!vrm || modelStore.interactionMode !== 'tactile')
      return

    // [PHASE-3] INSTANT BRANCH: Reuse the hit data from the preceding single-click
    if (lastHitMesh) {
      console.log(`[WARDROBE] Instant Toggle: "${lastHitMesh.name}"`)
      lastHitMesh.visible = !lastHitMesh.visible

      const mat = Array.isArray(lastHitMesh.material) ? lastHitMesh.material[0] : lastHitMesh.material
      const matName = mat.name.replace(/\s*\(Instance\)$/, '').trim()

      if (vrm.expressionManager) {
        const candidates = vrm.expressionManager.expressions.filter((exp: any) => {
          const binds = exp.materialColorBind || exp._materialColorBinds || []
          const texBinds = exp.textureTransformBind || exp._textureTransformBinds || []
          return binds.some((b: any) => b.materialName === matName || matName.includes(b.materialName))
            || texBinds.some((b: any) => b.materialName === matName || matName.includes(b.materialName))
        })
        if (candidates.length > 0) {
          console.log(`[WARDROBE] Found:`, candidates.map((c: any) => c.expressionName || c.name))
        }
      }
      spawnPuff(intersectionPoint, vrm.scene, true)
      return // EXIT INSTANTLY (0ms)
    }

    // Fallback: If memory is empty, use the cached flat list (VISIBLE ONLY)
    mouse.x = (event.x / window.innerWidth) * 2 - 1
    mouse.y = -(event.y / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    resolveNodes(vrm)
    if (!raycaster.ray.intersectsBox(nodes.boundary))
      return

    const visibleFull = fullMeshCache.value.filter(m => m.visible)
    const intersects = raycaster.intersectObjects(visibleFull, false)
    if (intersects.length > 0) {
      const hit = intersects[0]
      const mesh = hit.object as THREE.Mesh
      mesh.visible = !mesh.visible
      spawnPuff(hit.point, vrm.scene, true)
    }
  }

  function handleTug(event: { x: number, y: number }, camera: THREE.Camera) {
    if (!isDragging.value || !targetBone.value)
      return

    mouse.x = (event.x / window.innerWidth) * 2 - 1
    mouse.y = -(event.y / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const plane = new THREE.Plane()
    const boneWorldPos = new Vector3()
    targetBone.value.getWorldPosition(boneWorldPos)
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()).negate(), boneWorldPos)

    const dragTarget = new Vector3()
    raycaster.ray.intersectPlane(plane, dragTarget)

    const parent = targetBone.value.parent
    if (parent) {
      const localTarget = parent.worldToLocal(dragTarget.clone())
      const pullDir = localTarget.sub(basePosition)
      const dist = pullDir.length()
      currentTension.value = Math.min(dist / maxStretch, 1.0)
      if (dist > maxStretch)
        pullDir.normalize().multiplyScalar(maxStretch)
      targetBone.value.position.copy(basePosition.clone().add(pullDir))
    }
  }

  function endTug() {
    isDragging.value = false
  }

  function update(vrm: VRM, delta: number) {
    if (!vrm)
      return

    if (!isDragging.value && activePuffs.length === 0 && currentTension.value === 0) {
      if (tetherLine.value)
        tetherLine.value.visible = false
      return
    }

    resolveNodes(vrm)

    for (let i = activePuffs.length - 1; i >= 0; i--) {
      const puff = activePuffs[i]
      puff.scale.multiplyScalar(1.03)
      const mat = puff.material as SpriteMaterial
      mat.opacity -= delta * 1.5
      if (mat.opacity <= 0) {
        puff.removeFromParent()
        mat.dispose()
        activePuffs.splice(i, 1)
      }
    }

    if (!isDragging.value && targetBone.value) {
      targetBone.value.position.lerp(basePosition, 0.1)
      currentTension.value = Math.max(0, currentTension.value - 0.1)
      if (targetBone.value.position.distanceTo(basePosition) < 0.001) {
        targetBone.value.position.copy(basePosition)
        targetBone.value = null
      }
    }

    if (vrm.expressionManager && currentTension.value > 0) {
      const tension = currentTension.value
      vrm.expressionManager.setValue('surprised', Math.max(0, tension * (1.0 - tension) * 4) * 0.8)
      vrm.expressionManager.setValue('angry', (tension ** 2) * 0.7)
    }

    updateTether(vrm)
  }

  function updateTether(vrm: VRM) {
    if (!tetherLine.value || !isDragging.value || !targetBone.value) {
      if (tetherLine.value)
        tetherLine.value.visible = false
      return
    }

    const mouthPoint = new Vector3()
    const anchor = nodes.jaw || nodes.head
    if (anchor)
      anchor.getWorldPosition(mouthPoint)
    else vrm.scene.getWorldPosition(mouthPoint)

    const bonePos = new Vector3()
    targetBone.value.getWorldPosition(bonePos)

    tetherPosBuffer[0] = mouthPoint.x; tetherPosBuffer[1] = mouthPoint.y; tetherPosBuffer[2] = mouthPoint.z
    tetherPosBuffer[3] = bonePos.x; tetherPosBuffer[4] = bonePos.y; tetherPosBuffer[5] = bonePos.z

    tetherLine.value.geometry.attributes.position.needsUpdate = true
    tetherLine.value.visible = true
  }

  return { isDragging, currentTension, startTug, toggleMesh, handleTug, endTug, update, tetherLine }
}
