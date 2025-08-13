'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './page.module.css'

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameId = useRef<number>(0)
  const statsRef = useRef({
    packets: 0,
    bandwidth: 0,
    nodes: 20
  })

  useEffect(() => {
    if (!mountRef.current) return

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    const dataNodes: THREE.Mesh[] = []
    let connections: THREE.Line[] = []
    let packets: THREE.Mesh[] = []
    let time = 0
    let lastConnectionUpdate = 0
    const nodeGeometry = new THREE.OctahedronGeometry(2, 0)
    const packetGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4)

    const init = () => {
      // Scene
      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x000000, 0.005)
      sceneRef.current = scene

      // Camera
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.set(0, 0, 80)

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      rendererRef.current = renderer
      mountRef.current!.appendChild(renderer.domElement)

      // Create data nodes
      const nodeCount = 50
      
      for (let i = 0; i < nodeCount; i++) {
        const nodeMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        })
        
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial)
        node.position.set(
          (Math.random() - 0.5) * 120,
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 60
        )
        node.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
          )
        }
        
        dataNodes.push(node)
        scene.add(node)
      }

      // Create connections
      updateConnections()

      // Create initial data packets
      for (let i = 0; i < 100; i++) {
        createPacket()
      }
    }

    const updateConnections = () => {
      // Remove old connections and dispose geometry/materials
      connections.forEach(line => {
        scene.remove(line)
        line.geometry.dispose()
        if (line.material instanceof THREE.Material) {
          line.material.dispose()
        }
      })
      connections = []

      // Create new connections
      for (let i = 0; i < dataNodes.length; i++) {
        for (let j = i + 1; j < dataNodes.length; j++) {
          const distance = dataNodes[i].position.distanceTo(dataNodes[j].position)
          if (distance < 25) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              dataNodes[i].position,
              dataNodes[j].position
            ])
            const material = new THREE.LineBasicMaterial({
              color: 0x00ff00,
              transparent: true,
              opacity: 0.2
            })
            const line = new THREE.Line(geometry, material)
            connections.push(line)
            scene.add(line)
          }
        }
      }
    }

    const createPacket = () => {
      if (packets.length > 200) return // Limit maximum packets
      
      const packetMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
      })
      
      const packet = new THREE.Mesh(packetGeometry, packetMaterial)
      const sourceNode = dataNodes[Math.floor(Math.random() * dataNodes.length)]
      const targetNode = dataNodes[Math.floor(Math.random() * dataNodes.length)]
      
      packet.position.copy(sourceNode.position)
      packet.userData = {
        source: sourceNode,
        target: targetNode,
        progress: 0,
        speed: 0.015 + Math.random() * 0.025
      }
      
      packets.push(packet)
      scene.add(packet)
    }

    const animate = () => {
      frameId.current = requestAnimationFrame(animate)
      time += 0.01

      // Animate nodes
      dataNodes.forEach((node, index) => {
        node.position.add(node.userData.velocity)
        node.rotation.x += 0.01
        node.rotation.y += 0.01
        
        // Bounce off boundaries
        if (Math.abs(node.position.x) > 60) node.userData.velocity.x *= -1
        if (Math.abs(node.position.y) > 30) node.userData.velocity.y *= -1
        if (Math.abs(node.position.z) > 30) node.userData.velocity.z *= -1
        
        // Pulse effect
        node.scale.setScalar(1 + Math.sin(time * 5 + index) * 0.2)
      })

      // Update connections every 2 seconds instead of every frame
      if (time - lastConnectionUpdate > 2) {
        updateConnections()
        lastConnectionUpdate = time
      }

      // Animate packets
      packets = packets.filter(packet => {
        packet.userData.progress += packet.userData.speed
        
        if (packet.userData.progress >= 1) {
          scene.remove(packet)
          // Dispose packet geometry and material
          if (packet.material instanceof THREE.Material) {
            packet.material.dispose()
          }
          return false
        }
        
        packet.position.lerpVectors(
          packet.userData.source.position,
          packet.userData.target.position,
          packet.userData.progress
        )
        
        packet.rotation.x += 0.1
        packet.rotation.y += 0.1
        
        return true
      })

      // Create new packets
      if (Math.random() < 0.3) {
        createPacket()
      }

      // Update stats
      statsRef.current.packets = packets.length
      statsRef.current.bandwidth = Math.sin(time) * 50 + 100
      statsRef.current.nodes = dataNodes.length

      // Camera movement
      camera.position.x = Math.sin(time * 0.2) * 50
      camera.position.y = Math.cos(time * 0.15) * 20
      camera.position.z = 80
      camera.lookAt(scene.position)

      renderer.render(scene, camera)
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    init()
    animate()
    window.addEventListener('resize', handleResize)

    return () => {
      const currentMount = mountRef.current
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId.current)
      
      // Dispose all Three.js resources
      dataNodes.forEach(node => {
        scene.remove(node)
        if (node.material instanceof THREE.Material) {
          node.material.dispose()
        }
      })
      
      connections.forEach(line => {
        scene.remove(line)
        line.geometry.dispose()
        if (line.material instanceof THREE.Material) {
          line.material.dispose()
        }
      })
      
      packets.forEach(packet => {
        scene.remove(packet)
        if (packet.material instanceof THREE.Material) {
          packet.material.dispose()
        }
      })
      
      nodeGeometry.dispose()
      packetGeometry.dispose()
      renderer.dispose()
      
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    const dataContainer = document.getElementById('dataContainer')
    if (!dataContainer) return

    const maxElements = 50 // Limit maximum DOM elements
    const activeElements = new Set<HTMLDivElement>()

    const interval = setInterval(() => {
      // Remove oldest elements if limit exceeded
      if (activeElements.size >= maxElements) {
        const oldestElement = activeElements.values().next().value
        if (oldestElement) {
          oldestElement.remove()
          activeElements.delete(oldestElement)
        }
      }

      const dataFlow = document.createElement('div')
      dataFlow.className = styles.dataFlow
      dataFlow.style.left = Math.random() * window.innerWidth + 'px'
      dataFlow.style.animationDelay = Math.random() * 5 + 's'
      dataFlow.textContent = Math.random().toString(2).substr(2, 8)
      dataContainer.appendChild(dataFlow)
      activeElements.add(dataFlow)
      
      setTimeout(() => {
        dataFlow.remove()
        activeElements.delete(dataFlow)
      }, 5000)
    }, 200) // Reduced frequency from 100ms to 200ms

    return () => {
      clearInterval(interval)
      // Clean up all remaining elements
      activeElements.forEach(element => element.remove())
      activeElements.clear()
    }
  }, [])

  useEffect(() => {
    const updateHUD = setInterval(() => {
      const packetsElement = document.getElementById('packets')
      const bandwidthElement = document.getElementById('bandwidth')
      const nodesElement = document.getElementById('nodes')
      
      if (packetsElement) packetsElement.textContent = statsRef.current.packets.toString()
      if (bandwidthElement) bandwidthElement.textContent = statsRef.current.bandwidth.toFixed(1)
      if (nodesElement) nodesElement.textContent = statsRef.current.nodes.toString()
    }, 100)

    return () => clearInterval(updateHUD)
  }, [])

  return (
    <>
      <div className={styles.matrixBg}></div>
      <div className={styles.hud}>
        <div className={styles.hudItem}>SYSTEM: ONLINE</div>
        <div className={styles.hudItem}>PACKETS: <span id="packets">0</span></div>
        <div className={styles.hudItem}>BANDWIDTH: <span id="bandwidth">0</span> GB/s</div>
        <div className={styles.hudItem}>NODES: <span id="nodes">0</span></div>
      </div>
      <div id="dataContainer"></div>
      <div ref={mountRef} />
    </>
  )
}