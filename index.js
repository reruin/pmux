const Server = require('./lib/index')
const fs = require('fs')
const path = require('path')

const parseConfig = (callback) => {
  let p = path.join(process.cwd() , 'config.json')
  function read(){
    try{
      return JSON.parse(fs.readFileSync(p))
    }catch(e){
      console.log(e)
      return null
    }
  }

  fs.watch(p , () => {
    callback(read())
  })

  callback(read())
}

const server = new Server()

parseConfig(config => {
  if(config) server.setConfig(config)
})