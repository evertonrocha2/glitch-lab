import * as folders from './note-folders.service.js'

export async function list(req, res) {
  res.json({ folders: await folders.listFolders(req.deps.store, req.user) })
}

export async function create(req, res) {
  res.status(201).json({ folder: await folders.createFolder(req.deps.store, req.user, req.body) })
}

export async function update(req, res) {
  res.json({ folder: await folders.updateFolder(req.deps.store, req.user, req.params.id, req.body) })
}

export async function remove(req, res) {
  await folders.deleteFolder(req.deps.store, req.user, req.params.id)
  res.json({ deleted: true })
}
