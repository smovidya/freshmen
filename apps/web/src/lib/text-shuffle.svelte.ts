import { untrack } from 'svelte';
import type { TeamMember } from './type';
import { departmentAcronymLookup, type DepartmentId } from './departments';

export function getDisplayName(member: TeamMember) {
	return `${member.nickname ?? member.firstname} ${departmentAcronymLookup[member.department as DepartmentId] ?? member.department}`;
}

export class ShufflingText {
	current = $state('');
	target = $state('');
	private intervalId: ReturnType<typeof setInterval> | null = $state(null);
	private timeoutId: ReturnType<typeof setTimeout> | null = $state(null);
	private revealIntervalId: ReturnType<typeof setInterval> | null = $state(null);
	private characterSet: string;

	shuffling = $derived(!!this.intervalId || !!this.timeoutId || !!this.revealIntervalId);

	constructor(initial: string, characterSet: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
		this.current = initial;
		this.target = initial;
		this.characterSet = characterSet;
	}

	startShuffle() {
		if (this.intervalId) return;

		this.intervalId = setInterval(() => {
			this.current = this.current
				.split('')
				.map(() => this.characterSet[Math.floor(Math.random() * this.characterSet.length)])
				.join('');
		}, 50);
	}

	stopShuffle() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		if (this.revealIntervalId) {
			clearInterval(this.revealIntervalId);
			this.revealIntervalId = null;
		}
		this.current = this.target;
		// console.log("stop");
	}

	set(text: string, ms = 750) {
		untrack(() => {
			this.target = text;
			if (this.current === text) {
				return;
			}
			if (ms === 0) {
				this.current = text;
				return;
			}

			this.stopShuffle();

			this.startShuffle();

			const steps = Math.ceil(ms / 50);
			let currentStep = 0;

			this.revealIntervalId = setInterval(() => {
				currentStep++;
				const revealIndex = Math.floor((currentStep / steps) * text.length);

				this.current =
					text.substring(0, revealIndex) +
					this.current
						.substring(revealIndex)
						.split('')
						.map(() => this.characterSet[Math.floor(Math.random() * this.characterSet.length)])
						.join('');

				if (currentStep >= steps) {
					clearInterval(this.revealIntervalId!);
					this.revealIntervalId = null;
					this.stopShuffle();
				}
			}, 50);

			this.timeoutId = setTimeout(() => {
				this.stopShuffle();
			}, ms);
		});
	}
}
