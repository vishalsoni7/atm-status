import L from 'leaflet'

// MapTiler doesn't fail when it refuses a tile (wrong key/site, quota used up):
// it answers 403 *with a picture* saying "Invalid key", which a normal <img>
// tile happily shows. Fetching tiles lets us see the status code, so a refusal
// counts as an error and the app can switch to its backup map.
export const CheckedTileLayer = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
    const img = document.createElement('img')
    img.alt = ''
    img.setAttribute('role', 'presentation')
    fetch(this.getTileUrl(coords), { mode: 'cors' })
      .then((res) => {
        if (!res.ok) throw new Error(`tile ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        img.onload = () => {
          URL.revokeObjectURL(url)
          done(undefined, img)
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          done(new Error('tile decode'), img)
        }
        img.src = url
      })
      .catch((err: Error) => done(err, img))
    return img
  },
}) as unknown as new (url: string, options?: L.TileLayerOptions) => L.TileLayer
