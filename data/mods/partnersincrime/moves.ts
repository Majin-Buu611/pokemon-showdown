export const Moves: {[k: string]: ModdedMoveData} = {
	attract: {
		inherit: true,
		condition: {
			noCopy: true, // doesn't get copied by Baton Pass
			onStart(pokemon, source, effect) {
				if (!(pokemon.gender === 'M' && source.gender === 'F') && !(pokemon.gender === 'F' && source.gender === 'M')) {
					this.debug('incompatible gender');
					return false;
				}
				if (!this.runEvent('Attract', pokemon, source)) {
					this.debug('Attract event failed');
					return false;
				}

				if (effect.id === 'cutecharm' || effect.id === 'ability:cutecharm') {
					this.add('-start', pokemon, 'Attract', '[from] ability: Cute Charm', '[of] ' + source);
				} else if (effect.id === 'destinyknot') {
					this.add('-start', pokemon, 'Attract', '[from] item: Destiny Knot', '[of] ' + source);
				} else {
					this.add('-start', pokemon, 'Attract');
				}
			},
			onUpdate(pokemon) {
				if (this.effectState.source && !this.effectState.source.isActive && pokemon.volatiles['attract']) {
					this.debug('Removing Attract volatile on ' + pokemon);
					pokemon.removeVolatile('attract');
				}
			},
			onBeforeMovePriority: 2,
			onBeforeMove(pokemon, target, move) {
				this.add('-activate', pokemon, 'move: Attract', '[of] ' + this.effectState.source);
				if (this.randomChance(1, 2)) {
					this.add('cant', pokemon, 'Attract');
					return false;
				}
			},
			onEnd(pokemon) {
				this.add('-end', pokemon, 'Attract', '[silent]');
			},
		},
	},
	gastroacid: {
		inherit: true,
		condition: {
			// Ability suppression implemented in Pokemon.ignoringAbility() within sim/pokemon.js
			onStart(pokemon) {
				this.add('-endability', pokemon);
				this.singleEvent('End', pokemon.getAbility(), pokemon.abilityState, pokemon, pokemon, 'gastroacid');
				const keys = Object.keys(pokemon.volatiles).filter(x => x.startsWith("ability:"));
				if (keys.length) {
					for (const abil of keys) {
						pokemon.removeVolatile(abil);
					}
				}
			},
		},
	},
	mimic: {
		inherit: true,
		onHit(target, source) {
			const disallowedMoves = [
				'behemothbash', 'behemothblade', 'chatter', 'dynamaxcannon', 'mimic', 'sketch', 'struggle', 'transform',
			];
			const move = target.lastMove;
			if (source.transformed || !move || disallowedMoves.includes(move.id) || source.moves.includes(move.id)) {
				return false;
			}
			if (move.isZ || move.isMax) return false;
			const mimicIndex = source.moves.indexOf('mimic');
			if (mimicIndex < 0) return false;
			if (!source.m.curMoves.includes('mimic')) return false;

			const mimickedMove = {
				move: move.name,
				id: move.id,
				pp: move.pp,
				maxpp: move.pp,
				target: move.target,
				disabled: false,
				used: false,
				virtual: true,
			};
			source.moveSlots[mimicIndex] = mimickedMove;
			source.m.curMoves[mimicIndex] = mimickedMove.id;
			this.add('-start', source, 'Mimic', move.name);
		},
	},
	safeguard: {
		inherit: true,
		condition: {
			duration: 5,
			durationCallback(target, source, effect) {
				if (source?.hasAbility('persistent')) {
					this.add('-activate', source, 'ability: Persistent', effect);
					return 7;
				}
				return 5;
			},
			onSetStatus(status, target, source, effect) {
				if (!effect || !source) return;
				if (effect.id === 'yawn') return;
				if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
				if (target !== source) {
					this.debug('interrupting setStatus');
					if (effect.id.endsWith('synchronize') || (effect.effectType === 'Move' && !effect.secondaries)) {
						this.add('-activate', target, 'move: Safeguard');
					}
					return null;
				}
			},
			onTryAddVolatile(status, target, source, effect) {
				if (!effect || !source) return;
				if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
				if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) {
					if (effect.effectType === 'Move' && !effect.secondaries) this.add('-activate', target, 'move: Safeguard');
					return null;
				}
			},
			onSideStart(side) {
				this.add('-sidestart', side, 'Safeguard');
			},
			onSideResidualOrder: 21,
			onSideResidualSubOrder: 2,
			onSideEnd(side) {
				this.add('-sideend', side, 'Safeguard');
			},
		},
	},
	sketch: {
		inherit: true,
		onHit(target, source) {
			const disallowedMoves = ['chatter', 'sketch', 'struggle'];
			const move = target.lastMove;
			if (source.transformed || !move || source.moves.includes(move.id)) return false;
			if (disallowedMoves.includes(move.id) || move.isZ || move.isMax) return false;
			const sketchIndex = source.moves.indexOf('sketch');
			if (sketchIndex < 0) return false;
			if (!source.m.curMoves.includes('sketch')) return false;
			const sketchedMove = {
				move: move.name,
				id: move.id,
				pp: move.pp,
				maxpp: move.pp,
				target: move.target,
				disabled: false,
				used: false,
			};
			source.moveSlots[sketchIndex] = sketchedMove;
			source.baseMoveSlots[sketchIndex] = sketchedMove;
			source.m.curMoves[sketchIndex] = sketchedMove.id;
			this.add('-activate', source, 'move: Sketch', move.name);
		},
	},
	skillswap: {
		inherit: true,
		onHit(target, source, move) {
			const targetAbility = target.getAbility();
			const sourceAbility = source.getAbility();
			const ally = source.side.active.find(mon => mon && mon !== source && !mon.fainted);
			const foeAlly = target.side.active.find(mon => mon && mon !== target && !mon.fainted);
			if (target.isAlly(source)) {
				this.add('-activate', source, 'move: Skill Swap', '', '', '[of] ' + target);
			} else {
				this.add('-activate', source, 'move: Skill Swap', targetAbility, sourceAbility, '[of] ' + target);
			}
			this.singleEvent('End', sourceAbility, source.abilityState, source);
			if (ally?.m.innate) {
				ally.removeVolatile(ally.m.innate);
				delete ally.m.innate;
			}

			this.singleEvent('End', targetAbility, target.abilityState, target);
			if (foeAlly?.m.innate) {
				foeAlly.removeVolatile(foeAlly.m.innate);
				delete foeAlly.m.innate;
			}

			source.ability = targetAbility.id;
			source.abilityState = {id: this.toID(source.ability), target: source};
			if (source.m.innate && source.m.innate.endsWith(targetAbility.id)) {
				source.removeVolatile(source.m.innate);
				delete source.m.innate;
			}
			if (ally && ally.ability !== targetAbility.id) {
				if (!source.m.innate) {
					source.m.innate = 'ability:' + ally.getAbility().id;
					source.addVolatile(source.m.innate);
				}
				ally.m.innate = 'ability:' + targetAbility.id;
				ally.addVolatile(ally.m.innate);
			}

			target.ability = sourceAbility.id;
			target.abilityState = {id: this.toID(target.ability), target: target};
			if (target.m.innate && target.m.innate.endsWith(sourceAbility.id)) {
				target.removeVolatile(target.m.innate);
				delete target.m.innate;
			}
			if (foeAlly && foeAlly.ability !== sourceAbility.id) {
				if (!target.m.innate) {
					target.m.innate = 'ability:' + foeAlly.getAbility().id;
					target.addVolatile(target.m.innate);
				}
				foeAlly.m.innate = 'ability:' + sourceAbility.id;
				foeAlly.addVolatile(foeAlly.m.innate);
			}

			if (!target.isAlly(source)) target.volatileStaleness = 'external';
			this.singleEvent('Start', targetAbility, source.abilityState, source);
			this.singleEvent('Start', sourceAbility, target.abilityState, target);
		},
	},
};
