#!/usr/bin/env node
import fs from "fs"
import path from "path"
import yaml from "yaml"
import { argv, cwd, exit } from "process"

/**
 * Формирует URL для скачивания пакета из npm реестра
 * @param {string} name Название и версия пакета (например, "lodash@4.17.21" или "@scope/name@1.0.0")
 * @returns {string} URL на архив пакета в npm реестре
 */
function buildURL(name) {
  const encodedName = name.startsWith("@")
    ? `@${name.slice(1).split("@")[0]}`
    : name.split("@")[0]
  const version = name.startsWith("@")
    ? name.slice(1).split("@")[1]
    : name.split("@")[1]

  const fileName = name.startsWith("@")
    ? `${encodedName.split("/")[1]}-${version}.tgz` // @scope/name → name-version.tgz
    : `${encodedName}-${version}.tgz`

  return `https://registry.npmjs.org/${encodedName}/-/` + fileName
}

/**
 * Получает список URL-ов зависимостей из объекта пакетов lock файла
 * @param {Object.<string, string|Object>} packages Объект пакетов из lock файла
 * @param {string} [lockType="npm"] Тип lock файла: "npm" или "pnpm"
 * @returns {Array<string>} Массив URL-ов для скачивания пакетов
 */
function gettingDeps(packages, lockType = "npm") {
  const packagesArray =
    lockType === "npm" ? Object.values(packages) : Object.keys(packages)

  // Подготавливаем данные в зависимости от типа lock файла
  let links = []

  if (lockType === "pnpm") {
    // Для pnpm: получаем название и версию и формируем ссылку
    links = packagesArray.map((packageElem) => buildURL(packageElem))
  } else {
    // Для npm: получаем resolved
    links = packagesArray
      .filter((packageElem) => packageElem?.resolved)
      .map(({ resolved }) => resolved)
  }

  return links
}

/**
 * Сохраняет список URL-ов зависимостей в файл
 * @param {Array<string>} depsList Массив URL-ов зависимостей
 * @returns {void}
 */
function saveDepsToFile(depsList) {
  const outputPath = path.resolve(cwd(), "deps-list.txt")
  const content = depsList.join("\n")

  try {
    fs.writeFileSync(outputPath, content, "utf-8")
    console.log(`✅ Список зависимостей сохранён в файл: ${outputPath}`)
  } catch (error) {
    console.error(`❌ Ошибка при сохранении файла: ${error.message}`)
    exit(1)
  }
}

/**
 * Получает информацию о проекте и возвращает список URL-ов зависимостей
 * @param {string|null} [folderPath] Путь к папке с проектом (если не указан, используется текущая директория)
 * @returns {Array<string>} Массив URL-ов зависимостей проекта
 */
function gettingFolderInfo(folderPath) {
  // Сначала пробуем найти pnpm-lock.yaml
  let lockFilePath = path.resolve(
    cwd(),
    `${folderPath ?? ""}`,
    "pnpm-lock.yaml"
  )
  let lockFileType = "pnpm"
  let isLockFileExists = fs.existsSync(lockFilePath)

  // Если pnpm-lock.yaml не найден, пробуем package-lock.json
  if (!isLockFileExists) {
    lockFilePath = path.resolve(
      cwd(),
      `${folderPath ?? ""}`,
      "package-lock.json"
    )
    lockFileType = "npm"
    isLockFileExists = fs.existsSync(lockFilePath)
  }

  if (!isLockFileExists) {
    console.error(
      "❌ pnpm-lock.yaml или package-lock.json не найдены в текущей директории."
    )
    exit(1)
  }

  let pkgData

  if (lockFileType === "pnpm") {
    // Парсим YAML для pnpm
    const yamlContent = fs.readFileSync(lockFilePath, "utf-8")
    const parsedYaml = yaml.parse(yamlContent)
    pkgData = parsedYaml.packages || {}
  } else {
    // Парсим JSON для npm
    const jsonContent = fs.readFileSync(lockFilePath, "utf-8")
    pkgData = JSON.parse(jsonContent).packages || {}
  }

  // Парсим package.json
  const packageContent = fs.readFileSync(
    path.resolve(cwd(), `${folderPath ?? ""}`, "package.json"),
    "utf-8"
  )
  const pkgName = JSON.parse(packageContent).name || {}

  console.log(`📦 Информация о проекте: ${pkgName} (${folderPath ?? ""})\n`)
  console.log(`Lock файл: ${lockFileType.toUpperCase()}\n`)

  return gettingDeps(pkgData, lockFileType)
}

// Параметры
const [_nodePath, _execPath, ...args] = argv

let depsList

// Собираем зависимости и сохраняем в файл
if (args.length) {
  depsList = [
    ...new Set(args.map((folderPath) => gettingFolderInfo(folderPath)).flat()),
  ]
} else {
  depsList = gettingFolderInfo()
}

saveDepsToFile(depsList)
