import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function read(relativePath) {
  try {
    return await readFile(path.join(projectRoot, relativePath), 'utf8')
  } catch (error) {
    throw new Error(`Missing required Android file: ${relativePath}`, { cause: error })
  }
}

const capacitorConfig = await read('capacitor.config.ts')
assert.match(capacitorConfig, /appId:\s*['"]com\.yuwon\.financialapp['"]/)
assert.match(capacitorConfig, /webDir:\s*['"]dist['"]/)
assert.match(capacitorConfig, /SystemBars:\s*{/)
assert.match(capacitorConfig, /insetsHandling:\s*['"]css['"]/)

const mainActivity = await read('android/app/src/main/java/com/yuwon/financialapp/MainActivity.java')
assert.match(mainActivity, /extends BridgeActivity/)

const androidVariables = await read('android/variables.gradle')
assert.match(androidVariables, /targetSdkVersion\s*=\s*36/)

const styles = await read('android/app/src/main/res/values/styles.xml')
assert.match(styles, /<item name="android:statusBarColor">@android:color\/transparent<\/item>/)
assert.match(styles, /<item name="android:navigationBarColor">@android:color\/transparent<\/item>/)
assert.match(styles, /<item name="android:windowLightStatusBar">true<\/item>/)
assert.match(styles, /<item name="android:windowLightNavigationBar">true<\/item>/)
assert.match(styles, /<item name="android:windowLayoutInDisplayCutoutMode">shortEdges<\/item>/)

const nativeUi = await read('src/lib/nativeUi.ts')
assert.match(nativeUi, /SystemBars\.setStyle/)
assert.match(nativeUi, /isDark \? SystemBarsStyle\.Dark : SystemBarsStyle\.Light/)
assert.match(nativeUi, /syncSystemBarsTheme\(document\.documentElement\.classList\.contains\(['"]dark['"]\)\)/)

console.log('Android edge-to-edge system-bar configuration is complete.')