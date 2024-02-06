import fs from 'node:fs/promises'

import type { AstroD2Config } from '../config'

import { exec } from './exec'
import type { DiagramMeta } from './meta'

const viewBoxRegex = /viewBox="\d+ \d+ (?<width>\d+) (?<height>\d+)"/

export async function isD2Installed() {
  try {
    await getD2Version()

    return true
  } catch {
    return false
  }
}

export async function generateD2Diagram(config: AstroD2Config, meta: DiagramMeta, input: string, outputPath: string) {
  const extraArgs = []

  if (
    (config.theme.dark !== false && meta.darkTheme !== false) ||
    (meta.darkTheme !== undefined && meta.darkTheme !== false)
  ) {
    extraArgs.push(`--dark-theme=${meta.darkTheme ?? config.theme.dark}`)
  }

  if (meta.animateInterval) {
    extraArgs.push(`--animate-interval=${meta.animateInterval}`)
  }

  if (meta.target !== undefined) {
    extraArgs.push(`--target='${meta.target}'`)
  }

  try {
    // The `-` argument is used to read from stdin instead of a file.
    await exec(
      'd2',
      [
        `--layout=${config.layout}`,
        `--theme=${meta.theme ?? config.theme.default}`,
        `--sketch=${meta.sketch}`,
        `--pad=${meta.pad}`,
        ...extraArgs,
        '-',
        outputPath,
      ],
      input,
    )
  } catch (error) {
    throw new Error('Failed to generate D2 diagram.', { cause: error })
  }

  return await getD2DiagramSize(outputPath)
}

export async function getD2DiagramSize(diagramPath: string): Promise<D2Size> {
  try {
    const content = await fs.readFile(diagramPath, 'utf8')
    const match = content.match(viewBoxRegex)
    const { height, width } = match?.groups ?? {}

    if (!height || !width) {
      return
    }

    const computedHeight = Number.parseInt(height, 10)
    const computedWidth = Number.parseInt(width, 10)

    return { height: computedHeight, width: computedWidth }
  } catch (error) {
    throw new Error(`Failed to get D2 diagram size at '${diagramPath}'.`, { cause: error })
  }
}

async function getD2Version() {
  try {
    const [version] = await exec('d2', ['--version'])

    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`Invalid D2 version, got '${version}'.`)
    }

    return version
  } catch (error) {
    throw new Error('Failed to get D2 version.', { cause: error })
  }
}

export type D2Size =
  | {
      height: number
      width: number
    }
  | undefined
