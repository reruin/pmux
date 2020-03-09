const EventEmitter = require('events')
const net = require('net')
const dgram = require('dgram')
const { pipe , pipeudp } = require('./utils')

const closeServer = (server) => {
  return new Promise((resolve , reject) => {
    server.close(resolve)
  })
}

class Server extends EventEmitter {
  constructor(options) {
    super()

    this.udpConnections = []
    this.setConfig(options)
  }

  async setConfig(options = {}){

    if( !options.port ){
      return
    }
    this.options = options

    this.parseRules()

    if( this.server ){
      await closeServer(this.server)
    }

    this.server = net.createServer()
    this.server.on('connection',this.onConnect.bind(this))

    this.server.listen(options.port , () => {
      console.log('Server Running at',options.port)
    })

    if( this.udpServer ){
      await closeServer(this.udpServer )
    }

    this.udpServer = dgram.createSocket({type:"udp4",reuseAddr:true} , this.onMessage.bind(this))

    this.udpServer.bind(options.port)
  }

  parseRules(){
    let defaultPorts = {dns:53,ssh:22,rdp:3389}
    let rules = this.options.rules || {}
    for(let protocol in rules){
      let [host , port = defaultPorts[protocol]] = rules[protocol].split(':')
      rules[protocol] = { host , port }
    }
    this.rules = rules
  }

  onConnect(socket){
    socket.once('end', () => {

    })

    socket.once('error', () => {
      socket.destroy()
    })

    socket.once('timeout', () => {
      socket.destroy()
    })

    socket.once('data', (data) => {
      let byte = data[0];
      let chunk = data.toString()
      // let ishttp = (byte == 22 || byte == 71);
      let isProxy = /^\x16\x03[\x00-\x03]/.test(chunk)
      let isRDP = /^\x03\x00\x00/.test(chunk)
      let dst


      // rdp:ETX NULL NULL
      if(this.rules.rdp && /^\x03\x00\x00/.test(chunk)){
        dst = this.rules.rdp
      }
      // ssh:SSH
      else if(this.rules.ssh && /^\x53\x53\x48/){
        dst = this.rules.ssh
      }
      // others
      else if(this.rules.tcp){
        dst = this.rules.tcp
      }

      if(dst){
        let src = socket.address()
        console.log(new Date().toISOString(),`TCP ${src.address}:${src.port}  <-->  ${dst.host}:${dst.port}`)

        let server = net.connect(dst)
        pipe(socket,server)
        server.write(data)
      }else{
        console.log('Unsupported TCP request: ',data,data.toString())
      }

    })
  }

  onMessage(message , src){
    let chunk = message.toString('hex')

    let dst
    //DNS -- -- 01 00 00 01 00 00 00 00 00 00
    if(this.rules.dns && /^..01000001000000000000/.test(chunk)){
      dst = this.rules.dns
    }
    //RDP-UDP
    else if(this.rules.rdp && /^(ffffffff00401|e0|3e)/.test(chunk)){
      dst = this.rules.rdp
    } 
    else if(this.rules.udp){
      dst = this.rules.udp4
    }

    let connected = pipeudp(src , dst , message , this.udpServer)
    if(connected){
      console.log(new Date().toISOString(),`UDP ${src.address}:${src.port}  <-->  ${connected.host}:${connected.port}`)
    }else{
      console.log(`Unsupported UDP ${src.address}:${src.port} request: `,message)
    }
  }

  close(){
  }
}

module.exports = Server