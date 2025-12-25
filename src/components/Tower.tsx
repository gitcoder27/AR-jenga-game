import { useMemo } from 'react'
import Block from './Block'

export default function Tower() {
    const blocks = useMemo(() => {
        const items = [];
        const levels = 18;
        const height = 1.5;
        const width = 2.5;
        const offset = 0.05; 

        for (let level = 0; level < levels; level++) {
            const isOdd = level % 2 !== 0;
            const y = level * height + height / 2;
            
            for (let i = -1; i <= 1; i++) {
                const spacing = width + offset;
                const pos = i * spacing;

                let position: [number, number, number];
                let rotation: [number, number, number];

                const jitterPos = 0.05;
                const jitterRot = 0.02;

                const jx = (Math.random() - 0.5) * jitterPos;
                const jz = (Math.random() - 0.5) * jitterPos;
                const jr = (Math.random() - 0.5) * jitterRot;

                if (isOdd) {
                    position = [0 + jx, y, pos + jz];
                    rotation = [0, Math.PI / 2 + jr, 0];
                } else {
                    position = [pos + jx, y, 0 + jz];
                    rotation = [0, 0 + jr, 0];
                }

                items.push({ 
                    id: `${level}-${i}`,
                    position,
                    rotation
                })
            }
        }
        return items;
    }, []);

    return (
        <group>
            {blocks.map(b => (
                <Block key={b.id} id={b.id} position={b.position} rotation={b.rotation} />
            ))}
        </group>
    )
}