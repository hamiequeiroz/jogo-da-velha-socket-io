//carregando modulos
const express    = require('express')
const handlebars = require('express-handlebars')
const bodyParser = require('body-parser')
const app        = express() 

//configuracões de socket
const server     = require('http').Server(app)
const socket     = require('socket.io')(server)

let NumJogadores = 0
let JogadoresDisponiveis=[]

//configuracoes
//Body Parser
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())

//Handlebars
app.engine('handlebars', handlebars({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')

//rotas
app.get('/', function(req, res){
    res.render('login')
})

app.post('/jogo', function(req, res){
    nome_ = req.body.nome;
    //verifica se o nome ja existe no vetor de jogadores
    let pos = recuperarPos(nome_) 
    
    //verificação se o jogador se desconectou e está entrando novamente.
    if(pos==false){
        NumJogadores++
        JogadoresDisponiveis.push([nome_,'<label class="badge alert-success">Disponível</label> <button class="btn btn-info btn-sm" onclick="enviarConvite(\''+nome_+'\')" id=\'bt-enviar-convite\' name=\'bt-enviar-convite\'>Enviar convite</button>','']) 
    }else{
        JogadoresDisponiveis[pos][1] = '<label class="badge alert-success">Disponível</label> <button class="btn btn-info btn-sm" onclick="enviarConvite(\''+nome_+'\')" id=\'bt-enviar-convite\' name=\'bt-enviar-convite\'>Enviar convite</button>'
    }

    res.render('jogo', {
        nome: nome_ 
    })
    
})

//rota para o arquivo css
app.get('/style/:css', function(req, res){  
    res.sendFile(__dirname + '/views/layouts/style.css');
})

app.get('/jogo/:style/:css', function(req, res){
    res.sendFile(__dirname + '/views/layouts/style.css');
})

//Pesquisa o nome e recuperar posicao do vetor
function recuperarPos(nome_){
   
    for(let i = 0; i < NumJogadores; i++){
        if(JogadoresDisponiveis[i][0] === nome_){
            return i;
        }
    }
    return false
}

//Pesquisa qual a posição o socket se encontra
function recuperarPosSocket(socket_){
   
    for(let i = 0; i < NumJogadores; i++){
        if(JogadoresDisponiveis[i][2] === socket_){
            return i;
        }
    }
    return false
}

//recebendo mensagens via socket dos clientes
socket.on('connection', (socket) => {

    console.log(socket.id)

    //recebendo conexões dos jogadores e guardando os ids dos sockets no vetor.
    socket.on('conectar', (data) => {
        let nomePos = recuperarPos(data.nome)
        JogadoresDisponiveis[nomePos][2] = socket.id
        
    });

    //envia os jogadores disponiveis para quem está pedindo
    socket.on('Server-Jogadores-Disponiveis', (data) => {
        console.log('Consulta de Jogadores Disponiveis')
        socket.emit('Cliente-Jogadores-Disponiveis', {
            NumJogadores: NumJogadores,
            JogadoresDisponiveis:JogadoresDisponiveis
        });
        socket.broadcast.emit('Cliente-Jogadores-Disponiveis', {
            NumJogadores: NumJogadores,
            JogadoresDisponiveis:JogadoresDisponiveis
        });
    });

    //recebe a mensagem de enviar convite 
    socket.on('enviar convite', (data) => {
        
        socket.join(data.sala, function(){
            console.log(socket.rooms)
        })
        
        //envia para o jogador a mensagem de convite
        socket.broadcast.emit(data.jogador2 + ' vamos jogar?', 
            {
                jogador1:data.jogador1
            }
        )
    });

    //recebe a mensagem de que alguem aceitou o convite 
    socket.on('aceitar convite', (data) => {
        
        socket.join(data.sala, function(){
            console.log(socket.rooms)
        })

        //envia a mensagem para o adversario avisando que o outro jogador aceitou
        socket.broadcast.to(data.sala).emit('Aceitou seu convite', {
            jogador1: data.jogador1,
            jogador2: data.jogador2
        })
        
    });

    //recebe a dinamica das jogadas
    socket.on('jogadas', function(data){
        
        //manda a mensagem de jogadas para o jogador da sala
        socket.broadcast.to(data.sala).emit('adversario jogou', {
            sala: data.sala,
            msg:  data.msg,
            tipo: data.tipo
        })
    })

    //recebe a mensagem de aviso de que alguem ganhou
    socket.on('Ganhei', function(data){
        //avisa o adversario que ele perdeu
        socket.broadcast.to(data.sala).emit('Perdeu', {
            sala:data.sala,
            msg: data.msg,
            tipo: data.tipo
        })
    })

    //recebe a mensagem de aviso que o jogo da sala velhou
    socket.on('Velhou', function(data){
        //envia a mensagem para o outro jogador da sala que o jogo velhou
        socket.broadcast.to(data.sala).emit('Velhou', {
            sala: data.sala,
            msg: data.msg,
            tipo: data.tipo
        })
    })

    //aviso que um jogador atingiu seu numero maximo de partidas permitido
    socket.on('Maximo de partidas', function(data){
        
        //recupera a posicao do jogador no vetor
        let posNome = recuperarPos(data.nome)
        //altera o status do jogador no vetor para 'Jogando o máximo de partidas'
        JogadoresDisponiveis[posNome][1] = '<label class="badge alert-danger">Jogando o máximo de partidas</label>'

        //envia a mensagem para todos os jogadores para atualizar a tela de jogadores disponiveis
        socket.broadcast.emit('Cliente-Jogadores-Disponiveis', {
            NumJogadores: NumJogadores,
            JogadoresDisponiveis:JogadoresDisponiveis
        });

    })

    //aviso que o jogador pode a ficar disponivel novamente
    socket.on('ficar disponivel', function(data){
        //recupera a posicao do jogador no vetor
        let posNome = recuperarPos(data.nome)
        //altera o status do jogador no vetor para 'disponivel'
        JogadoresDisponiveis[posNome][1] = '<label class="badge alert-success">Disponível</label> <button class="btn btn-info btn-sm" onclick="enviarConvite(\''+data.nome+'\')" id=\'bt-enviar-convite\' name=\'bt-enviar-convite\'>Enviar convite</button>'
        
        //envia a mensagem para todos os jogadores para atualizar a tela de jogadores disponiveis
        socket.broadcast.emit('Cliente-Jogadores-Disponiveis', {
            NumJogadores: NumJogadores,
            JogadoresDisponiveis:JogadoresDisponiveis
        });

    })

    //recebe o aviso que algum jogador se desconectou
    socket.on('disconnect', function() {
       
        //recupera posicao do jogador no vetor de jogadores disponiveis
        let posSocket = recuperarPosSocket(socket.id)
        
        //caso encontre o socket id
        if(posSocket != false){

            //altera o status do jogador no vetor para 'Indisponível'
            JogadoresDisponiveis[posSocket][1] = '<label class="badge alert-danger">Indisponível</label>' 
            NumJogadores--
            
             //envia a mensagem para todos os jogadores para atualizar a tela de jogadores disponiveis
            socket.broadcast.emit('Cliente-Jogadores-Disponiveis', {
                NumJogadores: NumJogadores,
                JogadoresDisponiveis:JogadoresDisponiveis
            });

            //envia a mensagem para todos os jogadores finalizarem as partidas com este jogador que se desconectou
            socket.broadcast.emit('jogador desconectou finalizar partidas', {
                nome: JogadoresDisponiveis[posSocket][0]
            });
        }
        

    });

    //recebe a mensagem que alguem quer sair do jogo aviso para sair do jogo
    socket.on('sair', function(data){

        //recupera posicao do jogador no vetor de jogadores disponiveis
        let pos = recuperarPos(data.nome)
        
        if(pos === 0){
            JogadoresDisponiveis.splice(pos,1)
        }else{
            JogadoresDisponiveis.splice(pos,pos)
        }
        
        NumJogadores--
        
        //envia jogadores disponiveis para atualizar a tela
        socket.broadcast.emit('Cliente-Jogadores-Disponiveis', {
            NumJogadores: NumJogadores,
            JogadoresDisponiveis:JogadoresDisponiveis
        });

        //envia jogadores para finalizar as partidas
        socket.broadcast.emit('jogador desconectou finalizar partidas', {
            nome: data.nome
        });
        
    })

})

//Executando o servidor
const PORT = 5000
server.listen(PORT, function(){
    console.log('Servidor iniciado!')
})

