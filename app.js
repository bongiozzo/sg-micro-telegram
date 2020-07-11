'use strict'

const { Telegraf } = require('telegraf')
//const Composer = require('telegraf/composer')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const commandParts = require('telegraf-command-parts')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const WizardScene = require('telegraf/scenes/wizard')
//const { leave } = Stage

const userInfo = require("./middlewares/user-info")
const api = require('sg-node-api')

const greeter = new Scene('greeter')
greeter.enter((ctx) => {
    ctx.reply('Main menu', Markup.keyboard(['/commit', '/contract', '/newgoal', '/mygoals', '/deletegoal']).resize().extra())
})

/**
 * Commit scene
 */
const commit = new WizardScene('commit',
    async (ctx) => {
        if (ctx.state.skip) {
            ctx.wizard.next()
            return ctx.wizard.steps[ctx.wizard.cursor](ctx)
        }
        let buttons = [ ctx.session.currentgoal.get('contract').get('duration') + 'm' ]
        if (ctx.state.command.splitArgs[1] && ctx.state.command.splitArgs[1] !== buttons[0] && 
            ctx.session.commit.validateDuration(ctx.state.command.splitArgs[1])) {
            buttons.unshift(ctx.state.command.splitArgs[1])
        }
        ctx.reply('What is the duration of your current commit in minutes or hours (1h)? Specify or just press the button',
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (!ctx.state.skip && ctx.session.commit.validateDuration(ctx.message.text)) {
            ctx.session.commit.set({ duration: ctx.message.text })
        }
        ctx.reply('What was done?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        if (ctx.session.currentgoal.get('contract').get('whats_next')) {
            ctx.reply('You can choose from your What is next? plans:\n' + ctx.session.currentgoal.get('contract').get('whats_next'))
        }
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commit.set({ whats_done: ctx.message.text })
        }
        ctx.reply('What\'s next?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip') {
            ctx.session.commit.set({ whats_next: ctx.message.text })
        }
        ctx.reply('Your commit:\n' + 
            `Goal: ${ctx.session.currentgoal.get('owner')}/${ctx.session.currentgoal.get('key')}\n` + // replace with contract's key attr
            `Duration: ${ctx.session.commit.get('duration')}m\n` +
            (ctx.session.commit.get('whats_done') !== null ? `What was done: ${ctx.session.commit.get('whats_done')}\n` : '') +
            (ctx.session.commit.get('whats_next') !== null ? `What is next: ${ctx.session.commit.get('whats_next')}\n` : '') +
            '\nFinish?',
            Markup.keyboard(['/finish','/cancel']).resize().extra()) // consider button with full text of the command instead /finish
        return ctx.wizard.next()
    },
    async (ctx) => {
        if (ctx.message.text !== '/finish') {
            ctx.reply('Ok... Leaving!')
            return ctx.scene.enter('greeter')
        }
        ctx.session.commit.save(ctx)
        ctx.reply('Commit is committed :)')
        return ctx.scene.enter('greeter')
    }
)

/**
 * Contract scene
 */
const contract = new WizardScene('contract',
    async (ctx) => {
        if (!(await findGoalFromArg(ctx))) return ctx.scene.enter('greeter')
        ctx.session.contract = new api.contract()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commitattr.whats_next = ctx.message.text
        }
        ctx.reply('Your new contract:\n' + 
            `Goal: ${ctx.session.currentgoal.get('owner').username}/${ctx.session.currentgoal.get('code')}\n` + // replace with universtal id method
            `Duration: ${ctx.session.commitattr.duration}\n` +
            ctx.session.commitattr.whats_done ? `What was done: ${ctx.session.commitattr.whats_done}\n` : '' +
            ctx.session.commitattr.whats_next ? `What is next: ${ctx.session.commitattr.whats_next}\n` : '' +
            '\nFinish?',
            Markup.keyboard(['/finish','/cancel']).resize().extra()) // consider button with full text of the command instead /finish
        return ctx.wizard.next()
    },
    async (ctx) => {
        if (ctx.message.text !== '/finish') {
            ctx.reply('Ok... Leaving!')
            return ctx.scene.enter('greeter')
        }
        ctx.session.contract.save(ctx)
        ctx.reply('Congrats! New contract was signed!')
        return ctx.scene.enter('greeter')
    }
)

/**
 * New goal scene
 */
const newGoal = new WizardScene('newgoal',
    (ctx) => {
        ctx.reply('Please give a name for your Shared Goal.\nEnglish, meaningful title is preferred, but you are free to choose.', 
            Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        ctx.session.currentgoal = new api.goal
        ctx.session.currentgoal.set({ title: ctx.message.text }) // Use regexp for Text without specials from the start
        ctx.reply('Ok. Please enter the short key for your Goal or use default with the button.',
            Markup.keyboard([ctx.message.text.toLowerCase().split(' ').join('_')].concat('/cancel')).resize().extra()) // Transliterate
        return ctx.wizard.next()
    },
    (ctx) => {
        if (!/^[a-zA-Z0-9-_]+$/.test(ctx.message.text)) { // Use regexp for Key without / and specials
            ctx.reply('Please use short string for key without spaces and special letters')
            return
        }
        ctx.session.currentgoal.set({ key: ctx.message.text })
        ctx.replyWithMarkdown('Please specify the Contract for your Goal.\nThe most common choice is `1h every day`.\n' +
                              'Other examples are `30m every monday, thursday` or `2h every 10, 25`', // remove every
            Markup.keyboard(['1h every day', '30m every monday, thursday', '2h every 10, 25'].concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    async (ctx) => {
        const contract = ctx.session.currentgoal.get('contract')
        const contractData = await contract.validateFormat(ctx, ctx.message.text)
        if (!contractData) {
            ctx.reply('Wrong format for contract')
            return
        }
        contract.set(contractData)
        const saved = await ctx.session.currentgoal.save(ctx)
        contract.set({goal: saved.get('id')}) // Ambiguous line
        contract.save(ctx)
    
        const goalUrl = `${ctx.session.user.get('username')}/${saved.get('key')}` // Replace with Contract's Key

        ctx.reply('You goal is created! You can share it with others\n' + 
                  'For editing your goals use /mygoals\nYou already can forward this command to your friends')
        ctx.reply(`/contract ${goalUrl} ${contract.toString()}`, Markup.keyboard([]).extra()) // Remove keyboard?
        return ctx.scene.enter('greeter')
    }
)

/**
 * Delete goal scene
 */
const deleteGoal = new WizardScene('deletegoal',
    async (ctx) => {
        if (!(await findGoalFromArg(ctx))) return ctx.scene.enter('greeter')
        ctx.replyWithMarkdown('Please send `I\'m sure!` to delete.', Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text !== 'I\'m sure!') {
            ctx.reply('Text isn\'t identical. Returning to main menu.')
            return ctx.scene.enter('greeter')
        }
        ctx.session.currentgoal.set({archived: true}) // replace with Delete goal
        ctx.session.currentgoal.save(ctx)
        ctx.reply('Goal is gone...')
        return ctx.scene.enter('greeter')
    }
)

const stage = new Stage()
stage.register(greeter, contract, newGoal, commit, deleteGoal)
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

// Find a way to use one
contract.command('/cancel', (ctx) => {
    ctx.scene.enter('greeter')
})
newGoal.command('/cancel', (ctx) =>  {
    ctx.scene.enter('greeter')
})
commit.command('/cancel', (ctx) =>  {
    ctx.scene.enter('greeter')
})
deleteGoal.command('/cancel', (ctx) =>  {
    ctx.scene.enter('greeter')
})

/**
 * /commit sg 90min WhatDone WhatsNext
 */
bot.command('/commit', async (ctx) =>  {
    if (!ctx.state.command.splitArgs[0]) {
        const contracts = await api.contract().findByUser(ctx)
        const buttons = contracts.filter((c) => (c.get('today') === true || c.get('overdue') === true)).map((c) => { //  - overdue, active and sort duration desc
            return `/commit ${c.get('goal').key} ${c.get('duration')}m "Was done"` // remove Was Done
        })
        ctx.reply('Select a contract to commit:', 
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
    } else {
        ctx.session.commit = new api.commit
        if (!(await findGoalFromArg(ctx))) return // replace with contract.find
        ctx.session.commit.set({ contract: ctx.session.currentgoal.get('contract') })
        // const re = new RegExp(/((?<owner>[^/\s]+)\/)?(?<key>[^\s]+)\s+((?<hours>\d+)\s*(h|hr)\s+)?((?<minutes>\d+)\s*(m|min)\s+)?$/)
        const sub_matches = ctx.message.text.match(ctx.session.commit.re) // replace with ctx.session.commit.re without mandatory whats_done
        if (!sub_matches || !sub_matches.groups) return
        ctx.session.commit.set({
            duration: sub_matches.groups.minutes ? sub_matches.groups.minutes : sub_matches.groups.hours * 60,
            whats_done: 'Was done',
            whats_next: 'Some next'
        })
        ctx.scene.enter('commit')
        ctx.state.skip = true
    }
})

/**
 * /contract Adidas/RunEveryDay 45min everyday
 * /contract bongiozzo/sg 1h everyday
 */
bot.command('/contract', async (ctx) =>  {
    ctx.scene.enter('contract')
    if (ctx.state.command.splitArgs[0]) {
        if (!(await findGoalFromArg(ctx))) return ctx.scene.leave()     
        ctx.wizard.next()
    }
})

/**
 * /newgoal RunEveryDay 1h everyday
 * /newgoal MoveToHouse 3h every saturday,sunday
 */
bot.command('/newgoal', async (ctx) =>  {
    if (ctx.state.command.splitArgs[0]) {
        // from command line
    } else {
        ctx.scene.enter('newgoal')
    }
})

/**
 * /mygoals - List my goals
 * Return Goal menu
 */
bot.command('/mygoals', async (ctx) =>  {

})

/**
 * /deletegoal - Delete goal
 * Return Goal menu
 */
bot.command('/deletegoal', async (ctx) =>  {
    if (!ctx.state.command.splitArgs[0]) {
        const goals = await api.goal().findAll(ctx) // Error
        const buttons = goals.map((c) => {
            return `/deletegoal ${c.get('key')}`
        })
        ctx.reply('Choose a goal to delete:', 
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
    } else {
        ctx.scene.enter('deletegoal')
    }
})

bot.launch()

// Move the logic of this function to sg-node-api
function getIdFromArg (ctx) {
    let id = ctx.state.command.splitArgs[0]
    const re = new RegExp('^(?<owner>[^/\\s]+)/(?<key>.+)$')
    const sub_matches = id.match(re)
    if (!sub_matches || !sub_matches.groups) {
        id = ctx.session.user.get('username') + '/' + id
    }
    return id
} 

async function findGoalFromArg (ctx) {
    ctx.session.currentgoal = await api.goal().find(ctx, getIdFromArg(ctx))
    if (!ctx.session.currentgoal) {
        ctx.reply('Goal was not found')
    }
    return ctx.session.currentgoal
}