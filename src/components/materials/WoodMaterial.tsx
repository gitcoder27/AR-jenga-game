import React from 'react'
import { useTexture } from '@react-three/drei'

export const WoodMaterial: React.FC = (props) => {
    // Uncomment when textures are present in public/textures/wood/
    /*
    const textures = useTexture({
        map: '/textures/wood/Wood01_Color.jpg',
        normalMap: '/textures/wood/Wood01_Normal.jpg',
        roughnessMap: '/textures/wood/Wood01_Roughness.jpg',
        aoMap: '/textures/wood/Wood01_AO.jpg',
    })
    return <meshStandardMaterial {...textures} {...props} />
    */

    // Fallback "Natural Wood" style
    return (
        <meshStandardMaterial 
            color="#E3C099" // Raw Pine/Oak color
            roughness={0.7} 
            metalness={0.0}
            {...props}
        />
    )
}
