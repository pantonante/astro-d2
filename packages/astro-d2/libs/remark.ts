import path from 'node:path'

import type { Code, Html, Parent, Root } from 'mdast'
import { SKIP, visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

import type { AstroD2Config } from '../config'

import { generateD2Diagram, type D2Size, getD2DiagramSize } from './d2'
import { throwErrorWithHint } from './integration'
import { type DiagramMeta, getMeta } from './meta'

export function remarkAstroD2(config: AstroD2Config) {
  return async function transformer(tree: Root, file: VFile) {
    const d2Nodes: [node: Code, context: VisitorContext][] = []

    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'd2') {
        d2Nodes.push([node, { index, parent }])
      }

      return SKIP
    })

    if (d2Nodes.length === 0) {
      return
    }

    await Promise.all(
      d2Nodes.map(async ([node, { index, parent }], d2Index) => {
        const outputPath = getOutputPaths(config, file, d2Index)
        const meta = getMeta(node.meta)
        let size: D2Size = undefined

        if (config.skipGeneration) {
          size = await getD2DiagramSize(outputPath.fsPath)
        } else {
          try {
            size = await generateD2Diagram(config, meta, node.value, outputPath.fsPath)
          } catch {
            throwErrorWithHint(
              `Failed to generate the D2 diagram at ${node.position?.start.line ?? 0}:${node.position?.start.column ?? 0}.`,
            )
          }
        }

        if (parent && index !== undefined) {
          parent.children.splice(index, 1, makHtmlImgNode(meta, outputPath.imgPath, size))
        }
      }),
    )
  }
}

function makHtmlImgNode(meta: DiagramMeta, imgPath: string, size: D2Size): Html {
  const attributes: Record<string, string> = {
    alt: meta.title,
    decoding: 'async',
    loading: 'lazy',
    src: imgPath,
  }

  computeImgSize(attributes, meta, size)

  return {
    type: 'html',
    value: `<img ${Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')} />`,
  }
}

function getOutputPaths(config: AstroD2Config, file: VFile, nodeIndex: number) {
  const relativePath = path.relative(file.cwd, file.path).replace(/^src\/(content|pages)\//, '')
  const parsedRelativePath = path.parse(relativePath)

  const relativeOutputPath = path.join(parsedRelativePath.dir, `${parsedRelativePath.name}-${nodeIndex}.svg`)

  return {
    fsPath: path.join(file.cwd, 'public', config.output, relativeOutputPath),
    imgPath: path.posix.join('/', config.output, relativeOutputPath),
  }
}

function computeImgSize(attributes: Record<string, string>, meta: DiagramMeta, size: D2Size) {
  if (meta.width !== undefined) {
    attributes['width'] = String(meta.width)

    if (meta.height !== undefined) {
      attributes['height'] = String(meta.height)
    } else if (size) {
      const aspectRatio = size.height / size.width
      attributes['height'] = String(Math.round(meta.width * aspectRatio))
    }
  } else if (size) {
    attributes['width'] = String(size.width)
    attributes['height'] = String(size.height)
  }
}

interface VisitorContext {
  index: number | undefined
  parent: Parent | undefined
}
