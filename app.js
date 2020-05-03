'use strict'

const { Telegraf } = require('telegraf')
//const Composer = require('telegraf/composer')
const session = require('telegraf/session')
const commandParts = require('telegraf-command-parts')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const { leave } = Stage
const Markup = require('telegraf/markup')
const WizardScene = require('telegraf/scenes/wizard')

const userInfo = require("./middlewares/user-info")
const api = require('sg-node-api')

// Greeter scene
const greeter = new Scene('greeter')
greeter.enter((ctx) => {
    ctx.reply('Main menu', Markup.keyboard(['/newgoal', '/mygoals']).resize().extra())
})

const newGoal = new WizardScene('newgoal',
    (ctx) => {
        // ctx.reply('Step 1', Markup.inlineKeyboard([
        //   Markup.urlButton('❤️', 'http://telegraf.js.org'),
        //   Markup.callbackButton('➡️ Next', 'next')
        // ]).extra())
        ctx.reply('Please give a name for your Shared Goal.\nEnglish, meaningful title is preferred, but you are free to choose.', 
            Markup.keyboard(['/cancel']).resize().extra()) // .oneTime())
        return ctx.wizard.next()
    },
//  stepHandler,
    (ctx) => {
        ctx.session.goalattr = {title: ctx.message.text}
        ctx.reply('Ok. Please enter the short ID for your Goal or use default with the button.',
            Markup.keyboard([ctx.session.goalattr.title.toLowerCase().split(' ').join('_')].concat('/cancel')).resize().extra()) // Transliterate
        return ctx.wizard.next()
    },
    (ctx) => {
        ctx.session.goalattr.code = ctx.message.text
        ctx.session.newgoal = api.goal()
        ctx.session.newgoal.set(ctx.session.goalattr)
        ctx.session.newgoal.save(ctx)
        ctx.replyWithMarkdown('Please specify the Contract for your Goal.\nThe most common choice is `1h every day`.\n' +
                              'Other examples are `30m monday, thursday` or `2h 10, 25`',
            Markup.keyboard(['1h every day', '30m monday, thursday', '2h 10, 25'].concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    async (ctx) => {
        const contract = ctx.session.newgoal.get('contract')
        contract.set({goal: ctx.session.newgoal.get('id')}) // Ambiguous line
        const contractData = await contract.validateFormat(ctx, ctx.message.text)
        if (!contractData) {
            ctx.reply('Wrong format for contract')
            return
        }
        contract.set(contractData)
        contract.save(ctx)
    
        const goalUrl = ctx.session.newgoal.get('owner').email.replace(/@.+/, '')
                    + `/${ctx.session.newgoal.get('code')}`

        ctx.replyWithMarkdown('You goal is created! You can share it with others\n' + 
                              '`/contract ' + goalUrl + ' ' + contract.toString() + '`\n\n' + 
                              'For editing your goals use `/mygoals`')
        return ctx.scene.leave()
    }
)

// stepHandler.action('next', (ctx) => {
//     ctx.reply('Step 2. Via inline button')
//     return ctx.wizard.next()
// })
// stepHandler.command('next', (ctx) => {
// ctx.reply('Step 2. Via command')
// return ctx.wizard.next()
// })
// stepHandler.use((ctx) => ctx.replyWithMarkdown('Press `Next` button or type /next'))

// Create scene manager
const stage = new Stage()
stage.command('/cancel', leave())

// Scene registration
stage.register(greeter, newGoal)

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.use(session())
bot.use(stage.middleware())
bot.use(commandParts())
bot.use(async (ctx, next) => {
    if (!ctx.session.user) {
        await userInfo.getUserInfo(ctx)
    }
    if (!ctx.scene || !ctx.scene.current) {
        ctx.scene.enter('greeter')
    }
    return next()
})

// /newgoal RunEveryDay 1h everyday
// /newgoal MoveToHouse 3h every saturday,sunday
bot.command('/newgoal', async (ctx) =>  {
    ctx.scene.enter('newgoal')
    // if (!ctx.state.command.splitArgs[0]) {
    //     ctx.reply('New Goal format exmaple:\n /newgoal Title 1h every day') // Replace with interactive Scene
    //     return
    // }
})

// /mygoals - List my goals
// Return Goal menu
bot.command('/mygoals', async (ctx) =>  {


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