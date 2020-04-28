'use strict'

const { Telegraf } = require('telegraf')
const session = require('telegraf/session')
const commandParts = require('telegraf-command-parts')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const { leave } = Stage

//const logger = __importDefault(require("./util/logger"))
const req = require("./util/req")
const userInfo = require("./middlewares/user-info")
const Goal = require('./models/Goal')


// Greeter scene
const greeter = new Scene('greeter')
greeter.enter((ctx) => {
//    ctx.reply('Main menu')
})

// Create scene manager
const stage = new Stage()
stage.command('cancel', leave())

// Scene registration
stage.register(greeter)

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.use(session())
bot.use(stage.middleware())
bot.use(commandParts())
bot.use(async (ctx, next) => {
    await userInfo.getUserInfo(ctx)
    ctx.scene.enter('greeter')
    return next()
})

// /newgoal RunEveryDay 1h everyday
// /newgoal MoveToHouse 3h every saturday,sundayCtqxf
bot.command('/newgoal', async (ctx) =>  {
    if (!ctx.state.command.splitArgs[0]) {
        ctx.reply('New Goal format exmaple:\n /newgoal Title 1h every day')
        return
    }
    const goal = new Goal.default()
    goal.set({
        title: ctx.state.command.splitArgs[0],
        owner: ctx.session.SGUser.get('id')
    })
    goal.save(ctx)
    const contract = goal.get('contract')
    const contractData = await contract.validateFormat(ctx, ctx.state.command.splitArgs.slice(1).join(" "))
    if (!contractData) {
        ctx.reply('wrong format')
        return
    }
    contract.set(contractData)
    contract.save(ctx) 
})

// /contract Adidas/RunEveryDay 45min everyday
// /contract bongiozzo/sg 1h everyday
bot.command('/contract', async (ctx) =>  {
    res = await req.make('contract', 
                        ctx.session.userInfo.userId,
                        ctx.state.command.splitArgs[0],
                        ctx.state.command.splitArgs[1],
                        ctx.state.command.splitArgs.slice(2).join(" "))
    ctx.reply(res)
})

// /commit sg 90min WhatDone WhatsNext
bot.command('/commit', async (ctx) =>  {
    res = await req.make('commit', 
                        ctx.session.userInfo.userId,
                        ctx.state.command.splitArgs[0],
                        ctx.state.command.splitArgs[1],
                        ctx.state.command.splitArgs.regexp(1), // Replace with Stage/Scene and additional question
                        ctx.state.command.splitArgs.regexp(2))
    ctx.reply(res)
})

bot.launch()