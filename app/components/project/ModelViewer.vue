<script setup lang="ts">
// Lazy-loaded three.js viewer for STL and (un-sliced) 3MF files. Client only.
import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

const props = defineProps<{ url: string, format: 'stl' | '3mf', color?: string }>()
const container = useTemplateRef<HTMLDivElement>('container')
const state = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

let renderer: WebGLRenderer | undefined
let frame = 0
let observer: ResizeObserver | undefined

onMounted(async () => {
  try {
    const THREE = await import('three')
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')
    const el = container.value!

    const scene: Scene = new THREE.Scene()
    const camera: PerspectiveCamera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 10000)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9590, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 2)
    sun.position.set(1, 2, 1.5)
    scene.add(sun)

    let object: Object3D
    if (props.format === 'stl') {
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js')
      const geometry = await new STLLoader().loadAsync(props.url)
      geometry.computeVertexNormals()
      object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: props.color ?? '#22C55E', roughness: 0.55, metalness: 0.05 }))
    }
    else {
      const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js')
      object = await new ThreeMFLoader().loadAsync(props.url)
      object.traverse((o: any) => {
        if (o.isMesh && (!o.material?.color || o.material.color.getHex() === 0xffffff)) {
          o.material = new THREE.MeshStandardMaterial({ color: props.color ?? '#22C55E', roughness: 0.55 })
        }
      })
    }

    // 3D printing files are Z-up; three.js is Y-up. Then centre on the grid, resting on it.
    object.rotation.x = -Math.PI / 2
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    object.position.set(-center.x, -box.min.y, -center.z)
    scene.add(object)

    const radius = Math.max(size.x, size.y, size.z) || 10
    const grid = new THREE.GridHelper(radius * 2.4, 12, 0x9aa5a0, 0xd5dbd7)
    ;(grid.material as any).transparent = true
    ;(grid.material as any).opacity = 0.5
    scene.add(grid)

    camera.position.set(radius * 1.4, radius * 1.1, radius * 1.6)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, size.y / 2, 0)
    controls.enableDamping = true
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 1.5
    controls.addEventListener('start', () => (controls.autoRotate = false))
    controls.update()

    observer = new ResizeObserver(() => {
      if (!renderer) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    })
    observer.observe(el)

    const loop = () => {
      controls.update()
      renderer!.render(scene, camera)
      frame = requestAnimationFrame(loop)
    }
    loop()
    state.value = 'ready'
  }
  catch (err) {
    state.value = 'error'
    errorMessage.value = (err as Error).message
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  renderer?.dispose()
  renderer?.forceContextLoss()
})
</script>

<template>
  <div class="relative size-full">
    <div ref="container" class="size-full touch-none" />
    <div v-if="state === 'loading'" class="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" /> Cargando modelo…
    </div>
    <div v-else-if="state === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center text-sm text-muted">
      <UIcon name="i-lucide-box" class="size-8" />
      No se pudo mostrar el modelo.
      <span class="text-xs">{{ errorMessage }}</span>
    </div>
  </div>
</template>
