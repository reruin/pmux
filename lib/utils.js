const dgram = require('dgram')

const pipe = (client, server) => {
  const onClose = err => {
    client.destroy();
    server.destroy();
  };
  const onError = err => {
    //console.log(err);
  };

  client.pipe(server)
  server.pipe(client)
  
  server.on('close', onClose);
  server.on('error', onError);
  client.on('close', onClose);
  client.on('error', onError);
}

const udpConnections = []
const timeout = 30 * 1000

const pipeudp = (src, dst , message , client) => {
  let id = `${src.address}:${src.port}`
  let connection = udpConnections[id]
  if( !connection ){
    if(!dst) return false

    let server = dgram.createSocket('udp4');

    server.on('error', (err) => {
      console.log(id,'error',err)
      client.close();
    })

    server.on('message', (msg) => {
      client.send(msg, src.port, src.host, (err) => {
        if(err) console.log(err)
        //server.close();
      });
    })

    server.on('close', (msg) => {
      console.log(id,'close',msg)
      delete udpConnections[id]
    })

    //server.bind(dst.port || 0, dst.host)
    udpConnections[id] = connection = { socket:server , addr:dst }
  }else{
    clearTimeout(connection.t);
    connection.t = null;
  }

  connection.socket.send(message, connection.addr.port, connection.addr.host, (err) => {
    //超时关闭
    if(!connection.t){
      connection.t = setTimeout(()=>{
        connection.socket.close()
      },timeout)
    }
    
    if (err) {
      console.log(err)
    }
  });

  return connection.addr

  
}


module.exports = { pipe , pipeudp }